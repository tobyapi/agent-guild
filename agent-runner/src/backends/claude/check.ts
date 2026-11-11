// 操作の確認を canUseTool に組み込む。パスの判定（permissions.ts）を通ったもののうち、外に影響する操作（コマンドの実行・
// Web ページを開く・作業フォルダの外への書き込み）をモデルに確かめる（judge.ts）。止めたら理由をエージェントに返し、
// チャットにも知らせる（人間には聞かない）。backendOptions の operationCheck で切れる（既定は確かめる）。

import type { CanUseTool, PermissionResult } from '@anthropic-ai/claude-agent-sdk';
import type { Permissions } from '../../protocol.ts';
import { isInside, optionBoolean, type RunRequest } from '../types.ts';
import type { Judge, Operation, Verdict } from './judge.ts';
import { fileAccessPolicy, targetOf, WRITE_TOOLS } from './permissions.ts';
import { unregisteredToolDenial } from './tool-policy.ts';

/** backendOptions のキー（真偽値。なければ確かめる） */
export const OPERATION_CHECK_OPTION = 'operationCheck';

/** 確かめるので、確認なしでは許さないツールと、その権限（パスがないので permissions.ts は扱わない） */
export const CHECKED_TOOLS: Readonly<Record<string, keyof Permissions>> = { Bash: 'runCommands', WebFetch: 'webFetch' };

/** 判定に見せる中身の長さの上限（1項目あたり） */
const DETAIL_LIMIT = 2000;

export function checksOperations(request: RunRequest): boolean {
  return optionBoolean(request.options, OPERATION_CHECK_OPTION) ?? true;
}

/** 確かめる操作。確かめないもの（読み取り・作業フォルダの中への書き込みなど）は null */
export function operationOf(toolName: string, input: Record<string, unknown>, workspace: string): Operation | null {
  if (toolName === 'Bash')
    return {
      label: 'コマンドの実行',
      detail: lines([
        ['コマンド', input.command],
        ['説明', input.description],
      ]),
    };
  if (toolName === 'WebFetch')
    return {
      label: 'Web ページを開く',
      detail: lines([
        ['URL', input.url],
        ['ページに聞くこと', input.prompt],
      ]),
    };
  if (!WRITE_TOOLS.has(toolName)) return null;
  const target = targetOf(toolName, input, workspace);
  if (isInside(target, workspace)) return null;
  const content = Object.fromEntries(
    Object.entries(input).filter(([key]) => key !== 'file_path' && key !== 'notebook_path'),
  );
  return {
    label: '作業フォルダの外への書き込み',
    detail: lines([
      ['書き込み先', target],
      ['内容', JSON.stringify(content)],
    ]),
  };
}

/** パスの判定のあと、外に影響する操作を judge に確かめる canUseTool。止めたら onBlocked でチャットに知らせる */
export function checkedPolicy(request: RunRequest, judge: Judge, onBlocked: (notice: string) => void): CanUseTool {
  const files = fileAccessPolicy(request);
  return async (toolName, input, options) => {
    const denied = unregisteredToolDenial(toolName);
    if (denied) return denied;
    const decided =
      toolName in CHECKED_TOOLS ? pathless(request, toolName, input) : await files(toolName, input, options);
    if (decided?.behavior !== 'allow') return decided;
    const operation = operationOf(toolName, input, request.workspace);
    if (operation === null) return decided;
    const verdict = await judge(operation);
    if (verdict.allow) return decided;
    onBlocked(blockedNotice(operation, verdict));
    return {
      behavior: 'deny',
      message: `この操作（${operation.label}）は、実行前の確認で止められました（理由: ${verdict.reason}）。人間には聞かずに、別のやり方で依頼を進めるか、できなかったことと理由を返答に書いてください。`,
    };
  };
}

/** チャットに残す知らせ（中身は先頭だけ） */
export function blockedNotice(operation: Operation, verdict: Verdict): string {
  const head = operation.detail.split('\n')[0]?.slice(0, 160) ?? '';
  return `🛡️ 操作の確認で止めました（${operation.label}）: ${verdict.reason}\n${head}`;
}

/** パスのないツールは、その権限があれば通す（tools で渡していなければそもそも呼ばれない） */
function pathless(request: RunRequest, toolName: string, input: Record<string, unknown>): PermissionResult {
  const permission = CHECKED_TOOLS[toolName];
  return permission !== undefined && request.permissions[permission]
    ? { behavior: 'allow', updatedInput: input }
    : { behavior: 'deny', message: `${toolName} は許可されていません` };
}

function lines(entries: readonly (readonly [string, unknown])[]): string {
  return entries
    .filter(([, value]) => typeof value === 'string' && value !== '')
    .map(([label, value]) => `${label}: ${String(value).slice(0, DETAIL_LIMIT)}`)
    .join('\n');
}
