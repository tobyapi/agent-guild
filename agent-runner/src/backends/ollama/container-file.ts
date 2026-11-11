// 指定フォルダのチャンネルでのファイル道具（Windows）。macOS の Seatbelt 版（scoped-file.ts）と同じく、決まったコードを
// OS の隔離（共通の隔離。MXC）の中で動かして読み書きする。見えるのは操作に許した範囲だけなので、パスを確かめたあとに
// リンクへ差し替えられても、範囲の外には届かない。相談相手の MEMORY.md は、読み取りを許した範囲の中でも見せない。

import { randomUUID } from 'node:crypto';
import { mkdir, realpath, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { runCommandLineInSandbox } from '../command-sandbox.ts';
import { BackendError, type RunRequest } from '../types.ts';
import type { LocalFileOperation } from './local-file.ts';

/** 成功したときの結果の先頭（このあとに、読んだ中身・一覧・written が続く） */
const SUCCESS = 'exit=0\n';
/** 1回の読み書きの時間切れ */
const FILE_TIMEOUT_MS = 30_000;

/**
 * 隔離の中で動かす、決まったコード（モデルの入力は JSON のファイルで渡し、コードとしては実行しない）。
 * 範囲は OS が守るので、ここでは種類（通常のファイルか）と、ほかの名前（ハードリンク）がないことを確かめる:
 * ハードリンクは、許した場所にある名前から、範囲の外のファイルの中身に届いてしまう。
 */
const CONTAINER_FILE_SCRIPT = String.raw`
import { constants } from 'node:fs';
import { open, readdir, readFile, stat } from 'node:fs/promises';
const { path, mode, content, limit } = JSON.parse(await readFile(process.argv[2], 'utf8'));
let handle;
try {
  if (mode === 'list_files') {
    if (!(await stat(path)).isDirectory()) throw Error('フォルダを指定してください');
    const result = (await readdir(path)).join('\n');
    if (Buffer.byteLength(result) > limit) throw Error('道具の出力が32KiBを超えました');
    process.stdout.write(result);
  } else {
    if (mode === 'write_file') {
      try { handle = await open(path, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL, 0o600); }
      catch (error) {
        if (error.code !== 'EEXIST') throw error;
        handle = await open(path, constants.O_WRONLY);
      }
    } else handle = await open(path, constants.O_RDONLY);
    const info = await handle.stat();
    if (!info.isFile() || info.nlink !== 1) throw Error('特殊ファイル・ハードリンクは扱えません');
    if (mode === 'write_file') {
      await handle.truncate(0);
      await handle.writeFile(content, 'utf8');
      process.stdout.write('written');
    } else {
      const buffer = Buffer.alloc(limit + 1);
      const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
      if (bytesRead > limit) throw Error('道具の出力が32KiBを超えました');
      process.stdout.write(buffer.subarray(0, bytesRead));
    }
  }
} catch (error) {
  process.stderr.write(error.code === 'EPERM' || error.code === 'EACCES' ? 'チャンネルの作業範囲外です' : error.message);
  process.exitCode = 1;
} finally { await handle?.close(); }
`;

/** 相談相手（読み取りだけを許した場所）の MEMORY.md のうち、実在するもの */
async function privateMemories(readable: readonly string[], writable: readonly string[]): Promise<string[]> {
  const candidates = readable.filter((root) => !writable.includes(root)).map((root) => join(root, 'MEMORY.md'));
  const found = await Promise.all(
    candidates.map((path) =>
      stat(path).then(
        () => path,
        () => null,
      ),
    ),
  );
  return found.filter((path): path is string => path !== null);
}

/** そのフォルダごと実在するものだけ、リンクを解決して返す */
async function resolved(paths: readonly string[]): Promise<string[]> {
  const found = await Promise.all(paths.map((path) => realpath(path).catch(() => null)));
  return found.filter((path): path is string => path !== null);
}

/**
 * operation は、パスの判定（folder-scope.ts）を通ったあとの操作。roots はこの操作に許す範囲（書き込みなら書ける場所、
 * 読み取りなら読める場所）。戻り値は、読んだ中身・一覧・written（local-file.ts と同じ）。失敗したら unsupported_permission
 */
export async function containerFile(
  request: RunRequest,
  operation: LocalFileOperation,
  signal: AbortSignal,
): Promise<string> {
  await mkdir(request.stateDir, { recursive: true });
  const [workspace, stateDir] = await Promise.all([realpath(request.workspace), realpath(request.stateDir)]);
  const writable = await resolved([request.workspace, ...(request.writableDirs ?? [])]);
  const readable = await resolved([request.workspace, ...request.readableDirs]);
  // コードと入力は、操作ごとのフォルダに置いて読み取りだけを許す（隔離の中からは書き換えられない）
  const jobDir = join(stateDir, 'container-file', randomUUID());
  await mkdir(jobDir, { recursive: true });
  const [script, input] = [join(jobDir, 'file-tool.mjs'), join(jobDir, 'input.json')];
  await writeFile(script, CONTAINER_FILE_SCRIPT, 'utf8');
  await writeFile(input, JSON.stringify(operation), 'utf8');
  const write = operation.mode === 'write_file';
  try {
    const result = await runCommandLineInSandbox(
      {
        cwd: workspace,
        writable: write ? operation.roots : [],
        // 読み取りの操作では読める場所だけを、書き込みの操作では書ける場所だけを見せる。Node 自身のフォルダも要る
        readable: [...(write ? [] : operation.roots), jobDir, dirname(process.execPath)],
        home: join(stateDir, 'command-home'),
        denied: await privateMemories(readable, writable),
        // 許可した場所のほかは、名前も見せない（親フォルダの一覧も許さない）
        tools: false,
      },
      // 親フォルダを確かめられないので、Node にはコードの場所のリンクを解決させない
      `"${process.execPath}" --no-addons --no-warnings --preserve-symlinks --preserve-symlinks-main "${script}" "${input}"`,
      { signal, timeoutMs: FILE_TIMEOUT_MS, outputLimit: operation.limit + 4096, stateDir },
    );
    if (!result.startsWith(SUCCESS)) throw new BackendError('unsupported_permission', result);
    return result.slice(SUCCESS.length);
  } finally {
    await rm(jobDir, { recursive: true, force: true });
  }
}
