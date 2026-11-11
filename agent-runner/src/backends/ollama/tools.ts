import { sandboxProcess } from './subprocess.ts';
export { sandboxProcess } from './subprocess.ts';
export { sandbox, seatbeltProfile, type Prepared } from './sandbox.ts';
import { canIsolate, type Prepared } from './sandbox.ts';
import { anywhere, fileTarget } from './file-target.ts';
import { localFile } from './local-file.ts';
// Codex の default-deny / 固定 sandbox-exec パス / 子プロセス継承を参考に独自実装。
// 出典と制約: docs/ollama-tools.md（Codex のコード・ポリシーは転載していない）。
import { SCOPED_FILE_SCRIPT } from './scoped-file.ts';
import { assertFolderScope } from '../folder-scope.ts';
import { realpath } from 'node:fs/promises';
import { relative, resolve, join } from 'node:path';
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
      // コマンドは、隔離できる OS でだけ使う
      (name === 'read_skill'
        ? p.skills
        : name === 'run_command'
          ? p.runCommands && p.readFiles && canIsolate()
          : p.readFiles),
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
  prepared: Prepared,
  context?: RunContext,
): Promise<string> {
  signal.throwIfAborted();
  assertToolPermission(request, name, args);
  if (!isJsonObject(args)) throw new BackendError('bad_request', '道具の引数が不正です');
  if (name === 'post') return postResult(args, context);
  if (name === 'read_skill') return skillResult(request, args.name);
  const value = toolValue(name, args);
  if (name === 'run_command') {
    if (!prepared.isolated) throw new BackendError('unsupported_permission', 'コマンドを隔離できない OS です');
    return sandboxProcess(prepared.profile, prepared.workspace, '/bin/sh', ['-c', value], signal);
  }
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
  prepared: Prepared,
): Promise<string> {
  let profile = prepared.profile;
  const run = (exe: string, argv: string[], input?: string) =>
    sandboxProcess(profile, prepared.workspace, exe, argv, signal, input);
  const memory = resolve(request.workspace, value) === join(request.workspace, 'MEMORY.md');
  const target = await fileTarget(request, value, name === 'write_file');
  if (memory && relative(target, join(await realpath(request.workspace), 'MEMORY.md')) !== '')
    throw new BackendError('unsupported_permission', 'MEMORY.mdのリンク先は操作できません');
  if (isInside(target, request.stateDir) && name === 'write_file')
    throw new BackendError('unsupported_permission', '管理領域への書き込みは許可されていません');
  // MEMORY is a file-tool exception only; commands keep the original role sandbox.
  if (memory) profile += `\n(allow file-read* file-write* (literal ${JSON.stringify(target)}))`;
  return scopedFile(request, name, target, args, prepared.isolated ? run : null);
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
  run: ((exe: string, argv: string[], input?: string) => Promise<string>) | null,
): Promise<string> {
  const roots = anywhere(request)
    ? ['/']
    : await Promise.all(
        (name === 'write_file'
          ? [request.workspace, ...(request.writableDirs ?? [])]
          : [request.workspace, ...request.readableDirs]
        ).map((root) => realpath(root)),
      );
  const mode = name as 'read_file' | 'list_files' | 'write_file';
  const content = mode === 'write_file' ? writeContent(args.content) : undefined;
  if (run === null) return localFile({ path: target, roots, mode, content, limit: OUTPUT_LIMIT });
  const result = await run(
    process.execPath,
    ['--no-addons', '--no-warnings', '--input-type=module', '-e', SCOPED_FILE_SCRIPT],
    JSON.stringify({
      path: target,
      roots,
      mode,
      limit: OUTPUT_LIMIT,
      ...(content === undefined ? {} : { content }),
    }),
  );
  if (!result.startsWith('exit=0\n')) throw new BackendError('unsupported_permission', result);
  return result.slice('exit=0\n'.length);
}
