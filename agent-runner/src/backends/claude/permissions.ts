// Claude で権限を守る仕組み: ファイル操作をパスで判定する canUseTool と、守れない権限の組み合わせの判定。

import { relative, resolve } from 'node:path';
import type { CanUseTool, PermissionResult } from '@anthropic-ai/claude-agent-sdk';
import type { PermissionKey, PermissionRule, Permissions } from '../../protocol.ts';
import { writableInWorkspace } from './writable-path.ts';
import { absoluteGlobDenial, expandedReadPolicy } from './secret-read.ts';
import { brokenRule, declaredRules, isInside, type ExplainedRule, type RunRequest } from '../types.ts';

export const WRITE_TOOLS = new Set(['Write', 'Edit', 'MultiEdit', 'NotebookEdit']);
const READ_TOOLS = new Set(['Read', 'Glob', 'Grep', 'LS']);
const PATH_FIELDS = ['file_path', 'notebook_path', 'path'] as const;
/** 作業場所の中の、次回以降の自分へのメモ（Rust の workspace.rs と同じ名前） */
const MEMORY_FILE = 'MEMORY.md';

/** ツールの入力が指すパス（相対パスは作業場所から。指定がなければ作業場所そのもの） */
export function targetOf(input: Record<string, unknown>, workspace: string): string {
  const field = PATH_FIELDS.map((key) => input[key]).find(
    (value): value is string => typeof value === 'string' && value !== '',
  );
  return resolve(workspace, field ?? workspace);
}

/**
 * 確認が必要になったツール呼び出しをパスで判定する。書き込みは作業場所の中だけ、読み取りは作業場所と readableDirs だけ。
 * readAnywhere なら読み取りだけ、writeAnywhere なら書き込みも読み取りもパスを問わない（作業場所の外のファイルを直すには、まず読む必要がある）。
 * readAnywhere の拡張範囲は secret-read.ts で秘密の場所と検索配下を点検する。
 * 作業場所の MEMORY.md（次回以降の自分へのメモ）だけは、読み書きの権限がなくても読み書きできる。
 * それ以外（許していないツール・範囲外のパス）は拒否する。WebSearch などパスのないツールは allowedTools で先に許している
 * （操作の確認をするときの Bash・WebFetch は check.ts が扱う）。
 */
export function fileAccessPolicy(request: RunRequest): CanUseTool {
  const { workspace, readableDirs, permissions } = request;
  const anywhere = permissions.writeAnywhere;
  const readableRoots = [workspace, ...readableDirs];
  const memory = resolve(workspace, MEMORY_FILE);
  const expandedRead = permissions.readAnywhere && !anywhere ? expandedReadPolicy(readableRoots) : null;
  const readableByScope = (toolName: string, target: string, isMemory: boolean): boolean =>
    READ_TOOLS.has(toolName) &&
    (isMemory ||
      (permissions.readFiles &&
        (permissions.readAnywhere || anywhere || readableRoots.some((root) => isInside(target, root)))));
  return async (toolName, input) => {
    const target = targetOf(input, workspace);
    const isMemory = relative(memory, target) === '';
    const writable =
      WRITE_TOOLS.has(toolName) &&
      (isMemory || permissions.writeFiles) &&
      (anywhere || (await writableInWorkspace(target, workspace)));
    const patternReason = anywhere ? null : absoluteGlobDenial(toolName, input);
    const inScope = readableByScope(toolName, target, isMemory);
    const reason =
      patternReason ?? (inScope && expandedRead !== null ? await expandedRead(toolName, target, input) : null);
    const readable = inScope && reason === null;
    const result: PermissionResult =
      writable || readable
        ? { behavior: 'allow', updatedInput: input }
        : { behavior: 'deny', message: denialMessage(toolName, target, reason, patternReason !== null) };
    return Promise.resolve(result);
  };
}

function denialMessage(tool: string, target: string, reason: string | null, patternDenied: boolean): string {
  const base = `${tool} は許可されていません（${target}）`;
  if (!reason) return base;
  const hint =
    !patternDenied && ['Grep', 'Glob', 'LS'].includes(tool)
      ? 'src など狭いフォルダを起点にするか、公開ファイルを個別に Read してください。'
      : '';
  return `${base}: ${reason}。${hint}`;
}

/**
 * 守れない権限の組み合わせ。作業場所の外への書き込みは、書き込みの範囲を広げるもの。
 * Bash はファイルとネットワークを自由に使える（Windows には Bash の sandbox がない）ので、
 * コマンドの実行には読み書き（作業場所の外も）と Web の権限が要る。
 */
const RULES: readonly ExplainedRule[] = [
  {
    when: 'writeAnywhere',
    requires: ['writeFiles'],
    reason: '作業場所の外への書き込みを許すなら、ファイルの書き込みも許してください',
  },
  {
    when: 'runCommands',
    requires: ['readFiles', 'writeFiles', 'writeAnywhere', 'webFetch', 'webSearch'],
    reason: 'コマンドの実行を許すと、作業場所の外も含めたファイルの読み書きやネットワークアクセスを止められません',
  },
];

/** 申告する権限の規則（BackendInfo.permissionRules） */
export const PERMISSION_RULES: readonly PermissionRule[] = declaredRules(RULES);

/**
 * 持ち出しの危険がある組（BackendInfo.leakRisks）。作業場所の外にも書けるなら読み取りもどこでもでき（fileAccessPolicy）、
 * Web 閲覧は URL に情報を入れて外へ送れる。コマンドの実行（Bash）を許すときは、必ずこの組もそろう（RULES）
 */
export const LEAK_RISKS: readonly (readonly PermissionKey[])[] = [
  ['readFiles', 'writeAnywhere', 'webFetch'],
  ['readFiles', 'readAnywhere', 'webFetch'],
];

/** Claude で守れない権限の組み合わせなら、その理由 */
export function unenforceableReason(permissions: Permissions): string | null {
  return brokenRule(RULES, permissions)?.reason ?? null;
}
