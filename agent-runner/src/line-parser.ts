// JSON Lines の分割（届いたかたまり → 行）とパース（行 → JSON オブジェクト）、イベントの直列化。
// stdio そのものは main.ts が扱う。

import { errorMessage } from './log.ts';
import type { RunnerEvent } from './protocol.ts';

export type JsonObject = Record<string, unknown>;

/** 受信した1行の解釈結果 */
export type ParsedLine =
  | { kind: 'empty' }
  | { kind: 'malformed'; reason: string }
  | { kind: 'message'; value: JsonObject };

/** 届いた文字列のかたまりを行に分ける。行の途中で切れたかたまりは次のかたまりとつなぐ */
export class LineSplitter {
  #pending = '';

  push(chunk: string): string[] {
    const lines = `${this.#pending}${chunk}`.split('\n');
    this.#pending = lines.pop() ?? '';
    return lines;
  }

  /** 入力の終わり。改行で終わっていなかった最後の行を返す */
  flush(): string[] {
    const rest = this.#pending;
    this.#pending = '';
    return rest === '' ? [] : [rest];
  }
}

export function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** 1行を解釈する。前後の空白（CRLF の \r を含む）は無視する */
export function parseLine(line: string): ParsedLine {
  const text = line.trim();
  if (text === '') return { kind: 'empty' };
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch (error) {
    return { kind: 'malformed', reason: `JSON として読めない行を受け取りました（${errorMessage(error)}）` };
  }
  if (!isJsonObject(value)) return { kind: 'malformed', reason: 'JSON オブジェクトではない行を受け取りました' };
  return { kind: 'message', value };
}

/** 改行つきの1行にする。JSON.stringify は文字列中の改行をエスケープするので、必ず1行に収まる */
export function serializeEvent(event: RunnerEvent): string {
  return `${JSON.stringify(event)}\n`;
}
