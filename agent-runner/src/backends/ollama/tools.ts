import { sandboxProcess } from './subprocess.ts';
export { sandboxProcess } from './subprocess.ts';
export { sandbox, seatbeltProfile } from './sandbox.ts';
// Codex の default-deny / 固定 sandbox-exec パス / 子プロセス継承を参考に独自実装。
// 出典と制約: docs/ollama-tools.md（Codex のコード・ポリシーは転載していない）。
import { SCOPED_FILE_SCRIPT } from './scoped-file.ts';
import { assertFolderScope, scopedTarget } from '../folder-scope.ts';
import { lstat, realpath } from 'node:fs/promises';
import { dirname, basename, resolve, join } from 'node:path';
import { isJsonObject, type JsonObject } from '../../line-parser.ts';
import { BackendError, isInside, type RunRequest, type RunContext } from '../types.ts';

import { OUTPUT_LIMIT } from './limits.ts';
export { OUTPUT_LIMIT, TOOL_LIMIT } from './limits.ts';
const names = ['read_file', 'list_files', 'write_file', 'run_command', 'read_skill', 'post'] as const;
type ToolName = (typeof names)[number];

export function toolNames(request: RunRequest): ToolName[] {
  const p = request.permissions;
  return names.filter(
    (name) =>
      name === 'post' ||
      name === 'read_file' ||
      name === 'write_file' ||
      (name === 'read_skill' ? p.skills : name === 'run_command' ? p.runCommands && p.readFiles : p.readFiles),
  );
}

export function toolDefinitions(request: RunRequest): JsonObject[] {
  return toolNames(request).map((name) => {
    const properties: JsonObject =
      name === 'post'
        ? { text: { type: 'string' } }
        : name === 'read_skill'
          ? { name: { type: 'string' } }
          : name === 'run_command'
            ? { command: { type: 'string' } }
            : { path: { type: 'string' } };
    if (name === 'write_file') properties.content = { type: 'string' };
    return {
      type: 'function',
      function: {
        name,
        description:
          name === 'write_file'
            ? 'Write UTF-8 text; parent must exist. Without writeFiles only workspace/MEMORY.md is allowed.'
            : name === 'read_file' && !request.permissions.readFiles
              ? 'Read workspace/MEMORY.md only.'
              : name.replaceAll('_', ' '),
        parameters: { type: 'object', properties, required: Object.keys(properties), additionalProperties: false },
      },
    };
  });
}

async function fileTarget(request: RunRequest, path: string, write: boolean): Promise<string> {
  if (request.writableDirs !== undefined) return scopedTarget(request, path, write);
  const absolute = resolve(request.workspace, path);
  let target: string;
  try {
    target = await realpath(absolute);
  } catch (error) {
    if (!write || !isJsonObject(error) || error.code !== 'ENOENT') throw error;
    if (
      await lstat(absolute).then(
        (info) => info.isSymbolicLink(),
        () => false,
      )
    )
      throw new BackendError('unsupported_permission', 'リンク先を確認できません');
    target = resolve(await realpath(dirname(absolute)), basename(absolute));
  }
  if (!request.permissions.writeAnywhere) {
    const roots = await Promise.all(
      (write ? [request.workspace] : [request.workspace, ...request.readableDirs]).map((root) => realpath(root)),
    );
    if (!roots.some((root) => isInside(target, root)))
      throw new BackendError('unsupported_permission', '許可されたフォルダの外です');
  }
  return target;
}

export function assertToolPermission(request: RunRequest, name: string, args: unknown): void {
  assertFolderScope(request);
  if (request.options.enableTools !== true || !toolNames(request).includes(name as ToolName))
    throw new BackendError('unsupported_permission', `${name} は許可されていません`);
  if (!isJsonObject(args)) throw new BackendError('bad_request', '道具の引数が不正です');
  if (['read_file', 'write_file'].includes(name)) {
    const memory =
      typeof args.path === 'string' && resolve(request.workspace, args.path) === join(request.workspace, 'MEMORY.md');
    if (!(name === 'write_file' ? request.permissions.writeFiles : request.permissions.readFiles) && !memory)
      throw new BackendError('unsupported_permission', 'このファイル操作は許可されていません');
  }
}

export async function executeTool(
  request: RunRequest,
  name: string,
  args: unknown,
  signal: AbortSignal,
  prepared: { profile: string; workspace: string },
  context?: RunContext,
): Promise<string> {
  signal.throwIfAborted();
  assertToolPermission(request, name, args);
  if (!isJsonObject(args)) throw new BackendError('bad_request', '道具の引数が不正です');
  if (name === 'post') return postResult(args, context);
  if (name === 'read_skill') return skillResult(request, args.name);
  const value = toolValue(name, args);
  if (name === 'run_command')
    return sandboxProcess(prepared.profile, prepared.workspace, '/bin/sh', ['-c', value], signal);
  return executeFile(request, name, args, value, signal, prepared);
}

function postResult(args: JsonObject, context?: RunContext): string {
  if (!context || typeof args.text !== 'string' || !args.text.trim() || Buffer.byteLength(args.text) > OUTPUT_LIMIT)
    throw new BackendError('bad_request', '投稿内容が不正です');
  context.onPost(args.text);
  return '投稿しました';
}

function skillResult(request: RunRequest, name: unknown): string {
  const skill = request.skills.find((skill) => skill.name === name);
  if (!skill) throw new BackendError('bad_request', '指定されたスキルがありません');
  return skill.body;
}

function toolValue(name: string, args: JsonObject): string {
  const value = args[name === 'run_command' ? 'command' : 'path'];
  if (typeof value !== 'string' || !value || value.length > OUTPUT_LIMIT || value.includes('\0'))
    throw new BackendError('bad_request', '道具の入力が不正です');
  return value;
}

async function executeFile(
  request: RunRequest,
  name: string,
  args: JsonObject,
  value: string,
  signal: AbortSignal,
  prepared: { profile: string; workspace: string },
): Promise<string> {
  let profile = prepared.profile;
  const run = (exe: string, argv: string[], input?: string) =>
    sandboxProcess(profile, prepared.workspace, exe, argv, signal, input);
  const memory = resolve(request.workspace, value) === join(request.workspace, 'MEMORY.md');
  const target = await fileTarget(request, value, name === 'write_file');
  if (memory && target !== join(await realpath(request.workspace), 'MEMORY.md'))
    throw new BackendError('unsupported_permission', 'MEMORY.mdのリンク先は操作できません');
  if (isInside(target, request.stateDir) && name === 'write_file')
    throw new BackendError('unsupported_permission', '管理領域への書き込みは許可されていません');
  // MEMORY is a file-tool exception only; commands keep the original role sandbox.
  if (memory) profile += `\n(allow file-read* file-write* (literal ${JSON.stringify(target)}))`;
  return scopedFile(request, name, target, args, run);
}

function writeContent(content: unknown): string {
  if (typeof content !== 'string' || Buffer.byteLength(content) > OUTPUT_LIMIT)
    throw new BackendError('bad_request', '書き込みは32KiBまでです');
  return content;
}

async function scopedFile(
  request: RunRequest,
  name: string,
  target: string,
  args: Record<string, unknown>,
  run: (exe: string, argv: string[], input?: string) => Promise<string>,
): Promise<string> {
  const roots = request.permissions.writeAnywhere
    ? ['/']
    : await Promise.all(
        (name === 'write_file'
          ? [request.workspace, ...(request.writableDirs ?? [])]
          : [request.workspace, ...request.readableDirs]
        ).map((root) => realpath(root)),
      );
  const result = await run(
    process.execPath,
    ['--no-addons', '--no-warnings', '--input-type=module', '-e', SCOPED_FILE_SCRIPT],
    JSON.stringify({
      path: target,
      roots,
      mode: name,
      limit: OUTPUT_LIMIT,
      ...(name === 'write_file' ? { content: writeContent(args.content) } : {}),
    }),
  );
  if (!result.startsWith('exit=0\n')) throw new BackendError('unsupported_permission', result);
  return result.slice('exit=0\n'.length);
}
