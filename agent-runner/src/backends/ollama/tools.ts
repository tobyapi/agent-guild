import { sandboxProcess } from './subprocess.ts';
export { sandboxProcess } from './subprocess.ts';
export { sandbox, seatbeltProfile } from './sandbox.ts';
// Codex の default-deny / 固定 sandbox-exec パス / 子プロセス継承を参考に独自実装。
// 出典と制約: docs/ollama-tools.md（Codex のコード・ポリシーは転載していない）。
import { SCOPED_FILE_SCRIPT } from './scoped-file.ts';
import { scopedTarget } from '../folder-scope.ts';
import { realpath } from 'node:fs/promises';
import { dirname, basename, resolve } from 'node:path';
import { isJsonObject, type JsonObject } from '../../line-parser.ts';
import { BackendError, isInside, type RunRequest } from '../types.ts';

import { OUTPUT_LIMIT } from './limits.ts';
export { OUTPUT_LIMIT, TOOL_LIMIT } from './limits.ts';
const names = ['read_file', 'list_files', 'write_file', 'run_command'] as const;
type ToolName = (typeof names)[number];

export function toolNames(request: RunRequest): ToolName[] {
  const p = request.permissions;
  return names.filter((name) =>
    name === 'run_command' ? p.runCommands && p.readFiles : name === 'write_file' ? p.writeFiles : p.readFiles,
  );
}

export function toolDefinitions(request: RunRequest): JsonObject[] {
  return toolNames(request).map((name) => {
    const properties: JsonObject =
      name === 'run_command' ? { command: { type: 'string' } } : { path: { type: 'string' } };
    if (name === 'write_file') properties.content = { type: 'string' };
    return {
      type: 'function',
      function: {
        name,
        description:
          name === 'write_file'
            ? 'Write UTF-8 text to a file whose parent directory exists.'
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

export async function executeTool(
  request: RunRequest,
  name: string,
  args: unknown,
  signal: AbortSignal,
  prepared: { profile: string; workspace: string },
): Promise<string> {
  signal.throwIfAborted();
  if (!toolNames(request).includes(name as ToolName))
    throw new BackendError('unsupported_permission', `${name} は許可されていません`);
  if (!isJsonObject(args)) throw new BackendError('bad_request', '道具の引数が不正です');
  const field = name === 'run_command' ? 'command' : 'path';
  const value = args[field];
  if (typeof value !== 'string' || !value || value.length > OUTPUT_LIMIT || value.includes('\0'))
    throw new BackendError('bad_request', '道具の入力が不正です');
  const run = (exe: string, argv: string[], input?: string) =>
    sandboxProcess(prepared.profile, prepared.workspace, exe, argv, signal, input);
  if (name === 'run_command') return run('/bin/sh', ['-c', value]);
  const target = await fileTarget(request, value, name === 'write_file');
  if (request.writableDirs !== undefined) {
    return scopedFile(request, name, target, args, run);
  }
  if (name === 'write_file') {
    return run('/usr/bin/tee', [target], writeContent(args.content));
  }
  return name === 'list_files' ? run('/bin/ls', ['-la', target]) : run('/bin/cat', [target]);
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
  const roots = await Promise.all(
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
