// Claude で権限を守る仕組み: ファイル操作をパスで判定する canUseTool（守れない権限の組み合わせは rules.ts）。

import { folderFileResult } from '../folder-scope.ts';
import { globEscapeReason, strayPathField, toolPath, unsafePathForm } from '../tool-paths.ts';
import { relative, resolve } from 'node:path';
import type { CanUseTool, HookCallback, PermissionResult } from '@anthropic-ai/claude-agent-sdk';
import { isJsonObject } from '../../line-parser.ts';
import { insideRoots } from './writable-path.ts';
import { registeredToolResult } from './tool-policy.ts';
import { expandedReadPolicy } from './secret-read.ts';
import type { RunRequest } from '../types.ts';

export const WRITE_TOOLS = new Set(['Write', 'Edit', 'MultiEdit', 'NotebookEdit']);
const READ_TOOLS = new Set(['Read', 'Glob', 'Grep', 'LS']);
/** 作業場所の中の、次回以降の自分へのメモ（Rust の workspace.rs と同じ名前） */
const MEMORY_FILE = 'MEMORY.md';

type FileDecision = (toolName: string, input: Record<string, unknown>) => Promise<PermissionResult>;

/** ツールの入力が指すパス（その道具が使う項目だけを見る。相対パスは作業場所から。指定がなければ作業場所そのもの） */
export function targetOf(toolName: string, input: Record<string, unknown>, workspace: string): string {
  return resolve(workspace, toolPath(toolName, input) ?? workspace);
}

/** パスや pattern の形だけで決まる拒否理由（権限や場所を調べる前に見る。tool-paths.ts） */
function formDenial(
  toolName: string,
  input: Record<string, unknown>,
  target: string,
  roots: readonly string[],
  anywhere: boolean,
): string | null {
  if (!READ_TOOLS.has(toolName) && !WRITE_TOOLS.has(toolName)) return null;
  const stray = strayPathField(toolName, input);
  if (stray !== null)
    return `${toolName} に ${stray} は指定できません（この道具が使うパスの項目だけを指定してください）`;
  const form = unsafePathForm(target, roots);
  if (form !== null) return form;
  return anywhere || toolName !== 'Glob' ? null : globEscapeReason(input.pattern);
}

/**
 * 確認が必要になったツール呼び出しをパスで判定する。書き込みは作業場所の中だけ、読み取りは作業場所と readableDirs だけ
 * （どちらも、リンクをたどった実体がその中にあること）。
 * readAnywhere なら読み取りだけ、writeAnywhere なら書き込みも読み取りもパスを問わない（作業場所の外のファイルを直すには、まず読む必要がある）。
 * readAnywhere の拡張範囲は secret-read.ts で秘密の場所と検索配下を点検する。
 * 作業場所の MEMORY.md（次回以降の自分へのメモ）だけは、読み書きの権限がなくても読み書きできる（外へのリンクなら不可）。
 * それ以外（許していないツール・範囲外のパス）は拒否する。WebSearch などパスのないツールは allowedTools で先に許している
 * （操作の確認をするときの Bash・WebFetch は check.ts が扱う）。
 */
export function fileAccessPolicy(request: RunRequest): CanUseTool {
  return fileDecision(request);
}

function fileDecision(request: RunRequest): FileDecision {
  const { workspace, readableDirs, permissions } = request;
  const anywhere = permissions.writeAnywhere;
  const readableRoots = [workspace, ...readableDirs];
  const memory = resolve(workspace, MEMORY_FILE);
  const expandedRead = permissions.readAnywhere && !anywhere ? expandedReadPolicy(readableRoots) : null;
  const readableByScope = async (toolName: string, target: string, isMemory: boolean): Promise<boolean> => {
    if (!READ_TOOLS.has(toolName)) return false;
    if (isMemory) return insideRoots(target, [workspace]);
    if (!permissions.readFiles) return false;
    return permissions.readAnywhere || anywhere || insideRoots(target, readableRoots);
  };
  const writableByScope = async (toolName: string, target: string, isMemory: boolean): Promise<boolean> =>
    WRITE_TOOLS.has(toolName) &&
    (isMemory || permissions.writeFiles) &&
    (anywhere || (await insideRoots(target, [workspace])));
  return async (toolName, input) => {
    const folder = await folderFileResult(request, toolName, input);
    if (folder) return folder;
    const registered = registeredToolResult(toolName, permissions, input);
    if (registered) return registered;
    const target = targetOf(toolName, input, workspace);
    const formReason = formDenial(toolName, input, target, readableRoots, anywhere);
    if (formReason !== null) return { behavior: 'deny', message: denialMessage(toolName, target, formReason, true) };
    const isMemory = relative(memory, target) === '';
    const writable = await writableByScope(toolName, target, isMemory);
    const inScope = await readableByScope(toolName, target, isMemory);
    const reason = inScope && expandedRead !== null ? await expandedRead(toolName, target, input) : null;
    const readable = inScope && reason === null;
    const result: PermissionResult =
      writable || readable
        ? { behavior: 'allow', updatedInput: input }
        : { behavior: 'deny', message: denialMessage(toolName, target, reason, false) };
    return result;
  };
}

/**
 * 同じ判定を PreToolUse でも行う。Claude Code は作業場所の中の読み取りなどを確認なしで通し、そのとき canUseTool は呼ばれない
 * （中のリンクや Glob の pattern で外を指す呼び出しが素通りする）。拒否だけを返し、許可は返さない（操作の確認は従来の経路で行う）。
 */
export function fileAccessHook(request: RunRequest): HookCallback {
  const decide = fileDecision(request);
  return async (input) => {
    if (input.hook_event_name !== 'PreToolUse' || !isJsonObject(input.tool_input)) return {};
    if (!READ_TOOLS.has(input.tool_name) && !WRITE_TOOLS.has(input.tool_name)) return {};
    const result = await decide(input.tool_name, input.tool_input);
    if (result.behavior !== 'deny') return {};
    return {
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason: result.message,
      },
    };
  };
}

function denialMessage(tool: string, target: string, reason: string | null, formDenied: boolean): string {
  const base = `${tool} は許可されていません（${target}）`;
  if (!reason) return base;
  const hint =
    !formDenied && ['Grep', 'Glob', 'LS'].includes(tool)
      ? 'src など狭いフォルダを起点にするか、公開ファイルを個別に Read してください。'
      : '';
  return `${base}: ${reason}。${hint}`;
}
