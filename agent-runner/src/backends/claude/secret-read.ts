// readAnywhere で追加した範囲だけに適用する。元から読める実体と writeAnywhere は変えない。
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
      'Application Support/Chromium',
      'Application Support/Microsoft Edge',
      'Application Support/BraveSoftware',
      'Application Support/Firefox',
      'Application Support/Arc',
      'Application Support/Vivaldi',
      'Application Support/Opera',
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
  return async (tool: string, target: string, input: Record<string, unknown>): Promise<boolean> => {
    try {
      const actual = await physical(target);
      // 元の読み取り範囲は維持するが、そこから外へ出るリンクは拡張範囲として判定する。
      if (await originalReadable(target, actual, readableRoots)) return true;
      if ((await forbidden(target, false)) || (await forbidden(actual, false))) return false;
      const searching = tool === 'Grep' || tool === 'Glob' || tool === 'LS';
      if (!searching) return true;
      // Glob の pattern で点検済みの起点を抜け出せないようにする。複雑な展開は許可しない。
      if (!safeSearchPattern(tool, input)) return false;
      if ((await forbidden(target, true)) || (await forbidden(actual, true))) return false;
      let count = 0;
      const inspect = async (path: string, depth: number): Promise<boolean> => {
        if (++count > SEARCH_ENTRY_LIMIT || depth > SEARCH_DEPTH_LIMIT || (await forbidden(path, true))) return false;
        const info = await lstat(path);
        // 検索ツールのリンク追跡方法に依存しない。子リンクは安全な行き先でも拒否する。
        if (info.isSymbolicLink()) return false;
        if (info.isFile()) return true;
        if (!info.isDirectory()) return false;
        for await (const entry of await opendir(path)) {
          if (!(await inspect(join(path, entry.name), depth + 1))) return false;
        }
        return true;
      };
      return await inspect(actual, 0);
    } catch {
      return false;
    }
  };
}
