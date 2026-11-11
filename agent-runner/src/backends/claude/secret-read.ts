// readAnywhere の拡張範囲を点検し、共通の Glob 絶対パス拒否理由を提供する。writeAnywhere は対象外。
import { lstat, opendir, realpath } from 'node:fs/promises';
import { homedir } from 'node:os';
import { basename, dirname, isAbsolute, join, resolve, sep } from 'node:path';
import { isInside } from '../types.ts';

/** 再帰検索の事前点検はメタデータのみ。点検しきれなければ許可しない。 */
const SEARCH_ENTRY_LIMIT = 10_000;
const SEARCH_DEPTH_LIMIT = 64;

/** macOS の大小文字違いも、除外判定では同じ場所として扱う。 */
function comparable(path: string): string {
  const normalized = resolve(path).normalize('NFC');
  return process.platform === 'darwin' || process.platform === 'win32' ? normalized.toLowerCase() : normalized;
}
function inside(target: string, root: string): boolean {
  return isInside(comparable(target), comparable(root));
}

/** 非存在の末尾は既存の親まで解決する。壊れたリンク・循環・読めない親は拒否する。 */
async function physical(path: string): Promise<string> {
  try {
    return await realpath(path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    const entry = await lstat(path).catch((error: NodeJS.ErrnoException) => {
      if (error.code === 'ENOENT') return null;
      throw error;
    });
    if (entry || dirname(path) === path) throw error;
    return join(await physical(dirname(path)), basename(path));
  }
}

/** 場所を問わない秘密ファイル名。親の名前にも適用し、同名のディレクトリ経由を拒否する。 */
function secretName(name: string): boolean {
  return (
    /^(?:\.env(?:\..*)?|id_(?:rsa|dsa|ecdsa|ed25519).*|guild\.db(?:[-.].*)?)$/i.test(name) ||
    /\.(?:pem|key|p12|pfx)$/i.test(name)
  );
}

function secretRoots(): string[] {
  const home = homedir();
  const library = join(home, 'Library');
  const codex = process.env.CODEX_HOME || join(home, '.codex');
  const claude = process.env.CLAUDE_CONFIG_DIR || join(home, '.claude');
  return [
    ...[
      '.ssh',
      '.gnupg',
      '.aws',
      '.azure',
      '.kube',
      '.docker',
      '.config/gcloud',
      '.config/gh',
      '.netrc',
      '.npmrc',
      '.pypirc',
      '.git-credentials',
      '.claude.json',
      '.zsh_history',
      '.zsh_history.new',
      '.bash_history',
      '.zsh_sessions',
      '.bash_sessions',
    ].map((path) => join(home, path)),
    ...[join(home, '.codex'), codex].flatMap((dir) => ['auth.json', 'config.toml'].map((file) => join(dir, file))),
    ...[join(home, '.claude'), claude].flatMap((dir) =>
      ['.credentials.json', 'settings.json', 'settings.local.json'].map((file) => join(dir, file)),
    ),
    ...[
      'Keychains',
      'Cookies',
      'Mail',
      'Messages',
      'Safari',
      'Accounts',
      'Containers/com.apple.Safari',
      'Containers/com.apple.mail',
      'Containers/com.apple.MobileSMS',
      'Group Containers/group.com.apple.notes',
      'Group Containers/group.com.apple.mail',
      'Group Containers/group.com.apple.messages',
      'Group Containers/group.com.apple.Safari',
      'Application Support/Google/Chrome',
      'Application Support/Google/Chrome Beta',
      'Application Support/Google/Chrome Canary',
      'Application Support/Chromium',
      'Application Support/Microsoft Edge',
      'Application Support/BraveSoftware',
      'Application Support/Firefox',
      'Application Support/Arc',
      'Application Support/Vivaldi',
      'Application Support/Opera',
      'Application Support/com.operasoftware.Opera',
      'Application Support/Zen',
      'Application Support/Dia',
      'Application Support/com.apple.TCC',
      'Application Support/com.agentguild.app/settings.json',
      'Application Support/com.agentguild.app/settings.json.tmp',
      'WebKit/com.agentguild.app',
      'HTTPStorages/com.agentguild.app',
      'Caches/com.agentguild.app',
    ].map((path) => join(library, path)),
  ];
}

async function originalReadable(target: string, actual: string, roots: readonly string[]): Promise<boolean> {
  for (const root of roots) {
    if (isInside(target, root) && inside(actual, await physical(root))) return true;
  }
  return false;
}

function safeSearchPattern(tool: string, input: Record<string, unknown>): boolean {
  if (tool !== 'Glob') return true;
  const pattern = input.pattern;
  return typeof pattern === 'string' && !isAbsolute(pattern) && !/\.\.|[\\{}~]/.test(pattern);
}

/** Glob は絶対 pattern で path を無視できるため、読み取り範囲の許可より前に使う。 */
export function absoluteGlobDenial(tool: string, input: Record<string, unknown>): string | null {
  return tool === 'Glob' && typeof input.pattern === 'string' && isAbsolute(input.pattern)
    ? 'Glob の絶対パス pattern は使えません。path に起点、pattern に相対パターンを指定してください'
    : null;
}

/** 拒否理由に子の名前やパスを含めない。検索の点検は内容を開かない。 */
async function inspectSearch(
  path: string,
  forbidden: (path: string, ancestors: boolean) => Promise<boolean>,
  depth = 0,
  state = { count: 0 },
): Promise<string | null> {
  if (++state.count > SEARCH_ENTRY_LIMIT) return '検索の事前点検が10,000エントリの上限を超えました';
  if (depth > SEARCH_DEPTH_LIMIT) return '検索の事前点検が深さ64の上限を超えました';
  if (await forbidden(path, true)) return '検索範囲に除外対象の名前または場所があります';
  const info = await lstat(path);
  if (info.isSymbolicLink()) return '検索範囲にシンボリックリンクがあります';
  if (info.isFile()) return null;
  if (!info.isDirectory()) return '検索範囲に通常のファイル・ディレクトリ以外の項目があります';
  for await (const entry of await opendir(path)) {
    const reason = await inspectSearch(join(path, entry.name), forbidden, depth + 1, state);
    if (reason) return reason;
  }
  return null;
}

/** null は許可、それ以外は子の名前を含まない拒否理由。 */
export function expandedReadPolicy(readableRoots: readonly string[]) {
  const roots = secretRoots();
  // 秘密の内容は開かない。既知の場所がリンクなら、その実体も除外する。
  let resolvedSecrets: Promise<string[]> | undefined;
  const protectedRoots = () =>
    (resolvedSecrets ??= Promise.all(
      roots.map(async (root) => {
        try {
          return await physical(root);
        } catch {
          return root;
        }
      }),
    ));
  const forbidden = async (path: string, ancestors: boolean): Promise<boolean> => {
    if (resolve(path).split(sep).some(secretName)) return true;
    const all = [...roots, ...(await protectedRoots())];
    return all.some((root) => inside(path, root) || (ancestors && inside(root, path)));
  };
  return async (tool: string, target: string, input: Record<string, unknown>): Promise<string | null> => {
    try {
      const actual = await physical(target);
      // 元の読み取り範囲は維持するが、そこから外へ出るリンクは拡張範囲として判定する。
      if (await originalReadable(target, actual, readableRoots)) return null;
      if ((await forbidden(target, false)) || (await forbidden(actual, false))) return '秘密情報の除外対象です';
      const searching = tool === 'Grep' || tool === 'Glob' || tool === 'LS';
      if (!searching) return null;
      // Glob の pattern で点検済みの起点を抜け出せないようにする。複雑な展開は許可しない。
      if (!safeSearchPattern(tool, input)) return 'Glob の pattern に起点外への展開を含む指定は使えません';
      if ((await forbidden(target, true)) || (await forbidden(actual, true))) {
        return '検索の起点が除外対象を含んでいます';
      }
      return await inspectSearch(actual, forbidden);
    } catch {
      return 'パスの解決または検索の事前点検ができませんでした';
    }
  };
}
