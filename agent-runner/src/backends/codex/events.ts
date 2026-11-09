// Codex のイベントの処理: 項目を途中経過にし、最終返答を取り出し、失敗を ErrorCode に対応づける。

import type { ThreadEvent, ThreadItem } from '@openai/codex-sdk';
import { activity } from '../describe.ts';
import { BackendError, classifyErrorText } from '../types.ts';

/** Windows で CLI のパスが MAX_PATH（260 文字）を超えると、存在していても spawn が ENOENT になる */
const LONG_PATH_HINT = 'Windows ではパスが 260 文字を超えると Codex CLI を起動できません。プロジェクトを短いパスに置いてください。';

export function codexError(detail: string): BackendError {
  const text = detail.trim();
  const hint = process.platform === 'win32' && /spawn .*ENOENT/.test(text) ? ` ${LONG_PATH_HINT}` : '';
  return new BackendError(classifyErrorText(text), `Codex の実行に失敗しました（${text}）${hint}`);
}

function describeItem(item: ThreadItem): string | undefined {
  switch (item.type) {
    case 'web_search':
      return activity.webSearch(item.query);
    case 'command_execution':
      return activity.command(item.command);
    case 'file_change':
      return activity.writeFile(item.changes[0]?.path);
    case 'mcp_tool_call':
      return activity.tool(`${item.server}.${item.tool}`);
    case 'reasoning':
      return activity.thinking();
    default:
      return undefined;
  }
}

/** イベントを1つ処理し、最終返答の候補があれば返す */
export function readEvent(event: ThreadEvent, onActivity: (detail: string) => void): string | undefined {
  switch (event.type) {
    case 'item.started':
    case 'item.updated': {
      const detail = describeItem(event.item);
      if (detail) onActivity(detail);
      return undefined;
    }
    case 'item.completed':
      if (event.item.type !== 'agent_message') return undefined;
      onActivity(activity.writing());
      return event.item.text;
    case 'turn.failed':
      throw codexError(event.error.message);
    case 'error':
      throw codexError(event.message);
    default:
      return undefined;
  }
}
