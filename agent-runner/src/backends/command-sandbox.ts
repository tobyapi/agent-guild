// コマンドを OS の隔離の中で動かす共通の部品（Windows）。許可した場所だけが見え、通信はできない。
// 隔離の実体は Windows 11 の MXC（Microsoft eXecution Containers）で、npm の @microsoft/mxc-sdk に入っている
// 実行ファイル wxc-exec.exe を子プロセスとして呼ぶ（SDK 本体は読み込まないので、Node の版に左右されない）。
// 使えない PC（古い Windows・ほかの OS）では available が false のままで、呼び出し側はコマンドを使わない。
// 設定の組み立ては command-sandbox/policy.ts。考え方と確かめたことは docs/command-sandbox.md。

import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { isJsonObject } from '../line-parser.ts';
import { errorMessage, logInfo } from '../log.ts';
import { containerConfig, homeDirs, powershellCommandLine, type CommandScope } from './command-sandbox/policy.ts';
import { isFile } from './executables.ts';
import { BackendError } from './types.ts';

export type { CommandScope } from './command-sandbox/policy.ts';

/** 使えるかの確認（--probe）を待つ上限 */
const PROBE_TIMEOUT_MS = 15_000;
/** 設定で渡した時間切れのあと、隔離の実行ファイルが終わらないときに強制終了するまでの余裕 */
const KILL_GRACE_MS = 5_000;

export interface SandboxRunOptions {
  signal: AbortSignal;
  /** コマンドの時間切れ */
  timeoutMs: number;
  /** 出力（標準出力と標準エラーの合計）の上限バイト数。超えたら止める */
  outputLimit: number;
  /** 設定ファイルを置く場所（隔離の中からは見えない管理領域） */
  stateDir: string;
}

/** 隔離の実行ファイル。環境変数 GUILD_WXC_EXEC が優先（なければ依存パッケージの中）。見つからなければ null */
export function sandboxExecutable(env: NodeJS.ProcessEnv = process.env): string | null {
  const override = env.GUILD_WXC_EXEC?.trim();
  if (override) return isFile(override) ? override : null;
  try {
    const manifest = createRequire(import.meta.url).resolve('@microsoft/mxc-sdk/package.json');
    const path = join(dirname(manifest), 'bin', process.arch, 'wxc-exec.exe');
    return isFile(path) ? path : null;
  } catch {
    return null;
  }
}

/** 子プロセスの出力を集める。上限・時間切れ・中断で止める。戻り値は `exit=<終了コード>\n<出力>` */
function collect(exe: string, args: readonly string[], options: SandboxRunOptions): Promise<string> {
  const { signal, timeoutMs, outputLimit } = options;
  signal.throwIfAborted();
  return new Promise((resolveResult, reject) => {
    // 隔離の中へ渡す環境変数は設定ファイルに書く。実行ファイル自身には、動くのに要るものだけを渡す
    const child = spawn(exe, [...args], { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    let output = Buffer.alloc(0);
    let failure: Error | undefined;
    const stop = (error: Error): void => {
      failure ??= error;
      child.kill();
    };
    const abort = (): void => stop(new BackendError('cancelled', '中断しました'));
    const timer = setTimeout(
      () => stop(new BackendError('internal', `コマンドが${Math.round(timeoutMs / 1000)}秒を超えました`)),
      timeoutMs + KILL_GRACE_MS,
    );
    signal.addEventListener('abort', abort, { once: true });
    const append = (data: Buffer): void => {
      if (output.length + data.length > outputLimit) stop(new BackendError('internal', '道具の出力が上限を超えました'));
      else output = Buffer.concat([output, data]);
    };
    child.stdout.on('data', append);
    child.stderr.on('data', append);
    child.on('error', (error) => stop(error));
    child.on('close', (code) => {
      clearTimeout(timer);
      signal.removeEventListener('abort', abort);
      if (failure) reject(failure);
      else resolveResult(`exit=${code}\n${output.toString('utf8')}`);
    });
    if (signal.aborted) abort();
  });
}

/** この PC の隔離が、設定どおりに閉じ込められる段階か（--probe の結果）。ACL の書き換えが要る段階は使わない */
function supported(probe: unknown): boolean {
  if (!isJsonObject(probe) || !isJsonObject(probe.probes)) return false;
  return (
    probe.tier === 'base-container' &&
    probe.needsDaclAugmentation === false &&
    probe.probes.baseContainerSupportsEnumeratePaths === true
  );
}

async function probe(): Promise<boolean> {
  if (process.platform !== 'win32') return false;
  const exe = sandboxExecutable();
  if (exe === null) return false;
  try {
    const options = { signal: AbortSignal.timeout(PROBE_TIMEOUT_MS), timeoutMs: PROBE_TIMEOUT_MS, outputLimit: 65_536 };
    const result = await collect(exe, ['--probe'], { ...options, stateDir: '' });
    const ok = result.startsWith('exit=0\n') && supported(JSON.parse(result.slice('exit=0\n'.length)));
    if (!ok) logInfo('この PC ではコマンドの隔離（MXC）を使えません。コマンドは使わずに動かします');
    return ok;
  } catch (error) {
    logInfo(`コマンドの隔離（MXC）を確認できませんでした（${errorMessage(error)}）`);
    return false;
  }
}

let probing: Promise<boolean> | undefined;
let ready = false;

/** 隔離が使えるかを確かめる（最初の1回だけ実際に確かめ、あとは結果を返す）。アダプタの probe と run の最初に呼ぶ */
export function prepareCommandSandbox(): Promise<boolean> {
  probing ??= probe().then((ok) => (ready = ok));
  return probing;
}

/** 隔離が使えると確かめ済みか（確かめる前は false = コマンドを使わない） */
export function commandSandboxReady(): boolean {
  return ready;
}

/**
 * コマンド（Windows PowerShell の文）を隔離の中で動かす。見えるのは scope の場所と道具のフォルダだけで、通信はできない。
 * 隔離を用意できなければ実行しない（通常のシェルへは切り替えない）。戻り値は `exit=<終了コード>\n<出力>`
 */
export async function runInSandbox(scope: CommandScope, command: string, options: SandboxRunOptions): Promise<string> {
  // 長すぎるコマンドは、ここで失敗として返す（async なので、呼び出し側は拒否された Promise として受け取る）
  return runCommandLineInSandbox(scope, powershellCommandLine(command, process.env), options);
}

/** 決まったプログラムのコマンドライン（アプリが組み立てたもの）を、隔離の中で動かす。戻り値は runInSandbox と同じ形 */
export async function runCommandLineInSandbox(
  scope: CommandScope,
  commandLine: string,
  options: SandboxRunOptions,
): Promise<string> {
  const exe = (await prepareCommandSandbox()) ? sandboxExecutable() : null;
  if (exe === null) throw new BackendError('unsupported_permission', 'この PC では OS の隔離を使えません');
  const config = containerConfig(scope, commandLine, process.env, options.timeoutMs);
  const configDir = join(options.stateDir, 'command-sandbox');
  const configFile = join(configDir, `${randomUUID()}.json`);
  for (const dir of [configDir, ...homeDirs(scope.home)]) await mkdir(dir, { recursive: true });
  await writeFile(configFile, JSON.stringify(config), 'utf8');
  try {
    return await collect(exe, ['--config', configFile], options);
  } finally {
    await rm(configFile, { force: true });
  }
}
