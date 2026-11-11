import { lstat, opendir, realpath } from 'node:fs/promises';
import { basename, dirname, isAbsolute, join, resolve } from 'node:path';
import type { HookCallback, PermissionResult } from '@anthropic-ai/claude-agent-sdk';
import { isJsonObject } from '../line-parser.ts';
import { BackendError, isInside, type RunRequest } from './types.ts';

const READ = new Set(['Read', 'Grep', 'Glob', 'LS']);
const WRITE = new Set(['Write', 'Edit', 'MultiEdit', 'NotebookEdit']);

/** No adapter may silently ignore a folder-channel request. */
export function assertFolderScope(request: RunRequest): void {
  if (request.writableDirs === undefined) return;
  if (request.backend === 'claude')
    throw new BackendError(
      'unsupported_permission',
      'Claudeのファイル操作は点検後のリンク差し替えを制限できないため、指定フォルダでは実行できません',
    );
  if (request.backend !== 'ollama')
    throw new BackendError('unsupported_permission', 'このバックエンドはフォルダ制限に未対応です');
  if (
    request.permissions.readAnywhere ||
    request.permissions.writeAnywhere ||
    request.permissions.skills ||
    request.permissions.runCommands
  )
    throw new BackendError('unsupported_permission', 'フォルダ制限と両立しない権限です');
  if (![request.workspace, ...request.readableDirs, ...request.writableDirs].every(isAbsolute))
    throw new BackendError('bad_request', 'フォルダ制限には絶対パスが必要です');
}

/** Resolve missing file tails without accepting dangling symlinks. */
async function physical(path: string): Promise<string> {
  try {
    return await realpath(path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT' || dirname(path) === path) throw error;
    const entry = await lstat(path).catch((failure: NodeJS.ErrnoException) => {
      if (failure.code === 'ENOENT') return null;
      throw failure;
    });
    if (entry) throw error;
    return join(await physical(dirname(path)), basename(path));
  }
}

export async function scopedTarget(request: RunRequest, path: string, write: boolean): Promise<string> {
  const lexical = resolve(request.workspace, path);
  const roots = [request.workspace, ...(write ? (request.writableDirs ?? []) : request.readableDirs)];
  const actual = await physical(lexical);
  const approved = await Promise.all(
    roots.map(async (root) => isInside(lexical, root) && isInside(actual, await realpath(root))),
  );
  if (!approved.some(Boolean)) throw new BackendError('unsupported_permission', 'チャンネルの作業範囲外です');
  // Consultation grants artifacts, never another agent's private memory.
  const writable = [request.workspace, ...(request.writableDirs ?? [])];
  for (const root of request.readableDirs) {
    if (!writable.includes(root) && actual === join(await realpath(root), 'MEMORY.md'))
      throw new BackendError('unsupported_permission', '相談相手のMEMORY.mdは共有されません');
  }
  await ordinaryFile(actual, write);
  return actual;
}

async function ordinaryFile(actual: string, write: boolean): Promise<void> {
  const info = await lstat(actual).catch((error: NodeJS.ErrnoException) => {
    if (write && error.code === 'ENOENT') return null;
    throw error;
  });
  if (info && ((!info.isFile() && !info.isDirectory()) || (info.isFile() && info.nlink > 1)))
    throw new BackendError('unsupported_permission', '特殊ファイルやハードリンクは扱えません');
}

function checkGlob(tool: string, input: Record<string, unknown>): void {
  if (tool !== 'Glob') return;
  if (typeof input.pattern !== 'string' || isAbsolute(input.pattern) || /\.\.|[\\{}~]/.test(input.pattern))
    throw new BackendError('unsupported_permission', 'Globには起点内の相対パターンを指定してください');
}

async function inspect(request: RunRequest, path: string, state = { count: 0 }, depth = 0): Promise<void> {
  if (++state.count > 10000 || depth > 64)
    throw new BackendError('unsupported_permission', '検索の点検上限です。起点を狭いフォルダにしてください');
  await scopedTarget(request, path, false);
  const info = await lstat(path);
  if (info.isSymbolicLink())
    throw new BackendError('unsupported_permission', 'リンクを含むフォルダの一括検索は使えません');
  if (info.isDirectory())
    for await (const entry of await opendir(path)) await inspect(request, join(path, entry.name), state, depth + 1);
}

export async function folderFileResult(
  request: RunRequest,
  tool: string,
  input: Record<string, unknown>,
): Promise<PermissionResult | null> {
  if (request.writableDirs === undefined || (!READ.has(tool) && !WRITE.has(tool))) return null;
  try {
    assertFolderScope(request);
    const write = WRITE.has(tool);
    const field = ['file_path', 'notebook_path', 'path'].find(
      (key) => typeof input[key] === 'string' && input[key] !== '',
    );
    const path = field ? (input[field] as string) : request.workspace;
    const memory = resolve(request.workspace, path) === join(request.workspace, 'MEMORY.md');
    if (!(write ? request.permissions.writeFiles : request.permissions.readFiles) && !memory)
      throw new BackendError('unsupported_permission', 'この役割では操作できません');
    checkGlob(tool, input);
    const target = await scopedTarget(request, path, write);
    if (['Grep', 'Glob', 'LS'].includes(tool)) await inspect(request, target);
    return { behavior: 'allow', updatedInput: { ...input, [field ?? 'path']: target } };
  } catch (error) {
    return {
      behavior: 'deny',
      message: error instanceof BackendError ? error.message : 'チャンネルの作業範囲を確認できませんでした',
    };
  }
}

/** Covers SDK auto-approved file calls as well as canUseTool. */
export function folderFileHook(request: RunRequest): HookCallback {
  return async (input) => {
    if (input.hook_event_name !== 'PreToolUse' || !isJsonObject(input.tool_input)) return {};
    const result = await folderFileResult(request, input.tool_name, input.tool_input);
    if (!result) return {};
    return {
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        ...(result.behavior === 'deny'
          ? { permissionDecision: 'deny', permissionDecisionReason: result.message }
          : { updatedInput: result.updatedInput }),
      },
    };
  };
}
