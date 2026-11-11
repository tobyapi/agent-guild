// コマンドを閉じ込める設定の組み立て（実行は ../command-sandbox.ts）。
// Windows の隔離（MXC の processcontainer）に渡す設定は「許可した場所だけ見える・通信なし」で、
// 役割の範囲（書ける場所・読める場所）と、コマンドが動くのに要る道具のフォルダだけを許可する。
// 親フォルダは名前の一覧だけを許し、その下の関係のないフォルダは隠す（./siblings.ts）。

import { existsSync, statSync } from 'node:fs';
import { delimiter, dirname, join, parse, resolve } from 'node:path';
import type { JsonObject } from '../../line-parser.ts';
import { withoutSecrets } from '../agent-env.ts';
import { BackendError, isInside } from '../types.ts';
import { childDirectories, hiddenSiblings } from './siblings.ts';

/** コマンドに許す範囲（どれもリンクを解決済みの絶対パス） */
export interface CommandScope {
  /** コマンドを始めるフォルダ */
  cwd: string;
  /** 読み書きできる場所（作業場所。home は自動で足す） */
  writable: readonly string[];
  /** 読み取りだけできる場所（相談元の成果物・スキルなど） */
  readable: readonly string[];
  /** 隔離の中専用のホーム（利用者の本物のホームは見せず、設定と一時ファイルはここに置かせる） */
  home: string;
  /** 読み取りを許した場所の中で、読ませないもの（相談相手の MEMORY.md など。実在するパスだけを渡す） */
  denied?: readonly string[];
  /**
   * 開発の道具を使えるようにするか（既定は true）: 道具のフォルダ（PATH）を読めるようにし、親フォルダの名前の一覧を許す。
   * 決まったプログラムだけを動かすときは false にして、許可した場所のほかは名前も見せない
   */
  tools?: boolean;
}

/** モデルが書いたコマンドの長さの上限（Windows のコマンドラインは 32767 文字まで。符号化で約 2.7 倍になる） */
export const COMMAND_MAX_CHARS = 8000;

const isDirectory = (path: string): boolean => {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
};

/**
 * コマンドが使う道具のフォルダ: PATH のうち、実在して、Windows のフォルダの外にあるもの（Windows と Program Files は
 * 隔離の中から最初から見える）。許可する範囲と重なるもの・ドライブの直下・ネットワーク上のものは足さない
 */
export function toolDirs(env: NodeJS.ProcessEnv, granted: readonly string[]): string[] {
  const windows = resolve(env.SystemRoot ?? env.windir ?? 'C:\\Windows');
  const path = Object.entries(env).find(([name]) => name.toUpperCase() === 'PATH')?.[1] ?? '';
  const dirs = path
    .split(delimiter)
    .map((dir) => dir.trim())
    .filter((dir) => dir !== '' && !/^[\\/]{2}/.test(dir))
    .map((dir) => resolve(dir));
  return [...new Set(dirs)].filter(
    (dir) =>
      dir !== parse(dir).root &&
      !isInside(dir, windows) &&
      !granted.some((root) => isInside(dir, root) || isInside(root, dir)) &&
      existsSync(dir) &&
      isDirectory(dir),
  );
}

/**
 * 許可した場所へたどり着くために、名前の一覧だけを見せる親フォルダ（中身は読めない）。プログラムはパスを先頭から
 * 1段ずつ確かめるので、これがないと動かないものがある（Node のモジュールの読み込み・npm など）。許可した場所の中は
 * 足さない（「一覧だけ」の方が狭いので、足すと読み取りの許可を打ち消してしまう）。この許可は下の階層すべてに効くので、
 * 関係のないフォルダは hiddenSiblings で隠す
 */
export function enumerablePaths(granted: readonly string[]): string[] {
  const found = new Set<string>();
  for (const path of granted) {
    for (let dir = dirname(path); dir !== dirname(dir); dir = dirname(dir)) found.add(dir);
    found.add(parse(path).root);
  }
  return [...found].filter((dir) => !granted.some((root) => isInside(dir, root)));
}

/**
 * 隔離の中に渡す環境変数。秘密らしい名前は除き（agent-env.ts）、ホームと設定・一時ファイルの場所は専用のホームへ向ける。
 * Windows に登録された利用者の環境変数を既定で引き継がせない（API キーが入っていることがある）ので、全部を明示して渡す
 */
export function sandboxEnv(env: NodeJS.ProcessEnv, home: string): Record<string, string> {
  const local = join(home, 'AppData', 'Local');
  const base = withoutSecrets(env, () => false);
  for (const name of Object.keys(base)) {
    if (['USERPROFILE', 'HOME', 'HOMEPATH', 'APPDATA', 'LOCALAPPDATA', 'TEMP', 'TMP'].includes(name.toUpperCase())) {
      delete base[name];
    }
  }
  return {
    ...base,
    USERPROFILE: home,
    HOME: home,
    APPDATA: join(home, 'AppData', 'Roaming'),
    LOCALAPPDATA: local,
    TEMP: join(local, 'Temp'),
    TMP: join(local, 'Temp'),
  };
}

/** 専用のホームの中に、先に作っておくフォルダ */
export function homeDirs(home: string): string[] {
  return [home, join(home, 'AppData', 'Roaming'), join(home, 'AppData', 'Local', 'Temp')];
}

/**
 * モデルが書いたコマンドを Windows PowerShell で動かすコマンドライン。引用符の解釈に左右されないよう、符号化して渡す。
 * 出力は UTF-8、終了コードは最後に動かしたプログラムのもの（失敗したコマンドレットは 1）。スクリプトの実行ポリシーは
 * 確かめさせない: 隔離の中ではその確認自体が失敗し、npm などの .ps1 の入口が動かない（閉じ込めは隔離が担う）
 */
export function powershellCommandLine(command: string, env: NodeJS.ProcessEnv): string {
  if (command.length > COMMAND_MAX_CHARS) {
    throw new BackendError('bad_request', `コマンドは${COMMAND_MAX_CHARS}文字までです`);
  }
  const script = [
    // 画面への出力・ほかのプログラムへの受け渡し・ファイルへの書き出しを UTF-8 にする（既定は地域ごとの文字コード）
    "[Console]::OutputEncoding = $OutputEncoding = [Text.UTF8Encoding]::new($false); $ProgressPreference = 'SilentlyContinue'",
    "foreach ($guildName in 'Out-File', 'Set-Content', 'Add-Content') { $PSDefaultParameterValues[\"${guildName}:Encoding\"] = 'utf8' }",
    command,
    '$guildOk = $?; if ($LASTEXITCODE) { exit $LASTEXITCODE } elseif (-not $guildOk) { exit 1 }',
  ].join('\n');
  const exe = join(env.SystemRoot ?? 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
  const encoded = Buffer.from(script, 'utf16le').toString('base64');
  return `"${exe}" -NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -OutputFormat Text -EncodedCommand ${encoded}`;
}

/**
 * 隔離の実行ファイル（wxc-exec.exe）に渡す設定（MXC の契約 1.0.0）。通信はすべて拒否し、画面は出せるが貼り付けと操作の
 * 注入は禁じる。list は、親フォルダの直下のフォルダを挙げる関数（テストで差し替える）
 */
export function containerConfig(
  scope: CommandScope,
  commandLine: string,
  env: NodeJS.ProcessEnv,
  timeoutMs: number,
  list: (dir: string) => string[] = childDirectories,
): JsonObject {
  const tools = scope.tools !== false;
  const writable = [...new Set([...scope.writable, scope.home])];
  const readable = [...new Set(scope.readable)].filter((dir) => !writable.some((root) => isInside(dir, root)));
  const readonly = tools ? [...readable, ...toolDirs(env, [...writable, ...readable])] : readable;
  const granted = [...writable, ...readonly];
  const parents = tools ? enumerablePaths(granted) : [];
  const denied = [...(scope.denied ?? []), ...hiddenSiblings(parents, granted, env, list)];
  const variables = sandboxEnv(env, scope.home);
  return {
    version: '1.0.0',
    containment: 'processcontainer',
    lifecycle: { destroyOnExit: true, preservePolicy: false },
    process: {
      commandLine,
      timeout: timeoutMs,
      cwd: scope.cwd,
      env: Object.entries(variables).map(([name, value]) => `${name}=${value}`),
      inheritDefaultEnv: false,
    },
    filesystem: { readwritePaths: writable, readonlyPaths: readonly, deniedPaths: denied },
    network: { egress: { default: 'deny' } },
    ui: { disable: false, clipboard: 'none', injection: false },
    processContainer: {
      leastPrivilege: false,
      capabilities: [],
      filesystem: { enumeratePaths: parents },
    },
  };
}
