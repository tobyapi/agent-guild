// Claude で権限を守る仕組み: ファイル操作をパスで判定する canUseTool と、守れない権限の組み合わせの判定。

import { resolve } from 'node:path';
import type { CanUseTool, PermissionResult } from '@anthropic-ai/claude-agent-sdk';
import type { PermissionRule, Permissions } from '../../protocol.ts';
import { brokenRule, declaredRules, isInside, type ExplainedRule, type RunRequest } from '../types.ts';

const WRITE_TOOLS = new Set(['Write', 'Edit', 'MultiEdit', 'NotebookEdit']);
const READ_TOOLS = new Set(['Read', 'Glob', 'Grep', 'LS']);
const PATH_FIELDS = ['file_path', 'notebook_path', 'path'] as const;

/** ツールの入力が指すパス（相対パスは作業場所から。指定がなければ作業場所そのもの） */
function targetOf(input: Record<string, unknown>, workspace: string): string {
  const field = PATH_FIELDS.map((key) => input[key]).find(
    (value): value is string => typeof value === 'string' && value !== '',
  );
  return resolve(workspace, field ?? workspace);
}

/**
 * 確認が必要になったツール呼び出しをパスで判定する。書き込みは作業場所の中だけ、読み取りは作業場所と readableDirs だけ。
 * writeAnywhere なら、書き込みも読み取りもパスを問わない（作業場所の外のファイルを直すには、まず読む必要がある）。
 * それ以外（許していないツール・範囲外のパス）は拒否する。WebSearch などパスのないツールは allowedTools で先に許している。
 */
export function fileAccessPolicy(request: RunRequest): CanUseTool {
  const { workspace, readableDirs, permissions } = request;
  const anywhere = permissions.writeAnywhere;
  const readableRoots = [workspace, ...readableDirs];
  return (toolName, input) => {
    const target = targetOf(input, workspace);
    const writable = WRITE_TOOLS.has(toolName) && permissions.writeFiles && (anywhere || isInside(target, workspace));
    const readable =
      READ_TOOLS.has(toolName) &&
      permissions.readFiles &&
      (anywhere || readableRoots.some((root) => isInside(target, root)));
    const result: PermissionResult =
      writable || readable
        ? { behavior: 'allow', updatedInput: input }
        : { behavior: 'deny', message: `${toolName} は許可されていません（${target}）` };
    return Promise.resolve(result);
  };
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

/** Claude で守れない権限の組み合わせなら、その理由 */
export function unenforceableReason(permissions: Permissions): string | null {
  return brokenRule(RULES, permissions)?.reason ?? null;
}
