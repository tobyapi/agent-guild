// Codex のイベントの処理: 項目を途中経過にし、途中の agent_message を投稿にし、最終返答を取り出し、
// 失敗を ErrorCode に対応づける。

import type { ThreadEvent, ThreadItem } from '@openai/codex-sdk';
import { activity } from '../describe.ts';
import { BackendError, classifyErrorText } from '../types.ts';

/** Windows で CLI のパスが MAX_PATH（260 文字）を超えると、存在していても spawn が ENOENT になる */
const LONG_PATH_HINT = 'Windows ではパスが 260 文字を超えると Codex CLI を起動できません。プロジェクトを短いパスに置いてください。';

type ItemPhase = Extract<ThreadEvent, { item: ThreadItem }>['type'];

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

/** 作業の項目か（これが来たら、その前の agent_message は途中の投稿だったとわかる）。to-do と警告は作業ではない */
const isWork = (item: ThreadItem): boolean => !['agent_message', 'todo_list', 'error'].includes(item.type);

/**
 * イベントを順に読む。agent_message はいったん手元に置き、あとに作業が続いたら途中の投稿として送る。
 * 最後まで手元に残ったものが最終返答（同じ文章を二重には投稿しない）。
 */
export class EventReader {
  readonly #onActivity: (detail: string) => void;
  readonly #onPost: (text: string) => void;
  /** まだ投稿も返答もしていない、直近の agent_message */
  #held: string | undefined;

  constructor(onActivity: (detail: string) => void, onPost: (text: string) => void) {
    this.#onActivity = onActivity;
    this.#onPost = onPost;
  }

  /** 最終返答（最後の agent_message。なければ空） */
  get finalText(): string {
    return this.#held ?? '';
  }

  read(event: ThreadEvent): void {
    switch (event.type) {
      case 'item.started':
      case 'item.updated':
      case 'item.completed':
        this.#item(event.type, event.item);
        return;
      case 'turn.failed':
        throw codexError(event.error.message);
      case 'error':
        throw codexError(event.message);
      default:
        return;
    }
  }

  #item(phase: ItemPhase, item: ThreadItem): void {
    if (item.type === 'agent_message') {
      if (phase !== 'item.completed') return;
      this.#release();
      this.#held = item.text;
      this.#onActivity(activity.writing());
      return;
    }
    if (isWork(item)) this.#release();
    const detail = phase === 'item.completed' ? undefined : describeItem(item);
    if (detail) this.#onActivity(detail);
  }

  /** 手元の agent_message を途中の投稿として送る（空なら送らない） */
  #release(): void {
    const text = this.#held?.trim();
    this.#held = undefined;
    if (text) this.#onPost(text);
  }
}
