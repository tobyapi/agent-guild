// 空行を除いた行数を数える（コメント行は数える。ESLint の max-lines の skipBlankLines と同じ数え方）。

import { LINE_LIMIT } from './config.mjs';

/**
 * @param {string} text
 * @returns {{ count: number, overflowLine: number | null }} overflowLine は上限に達した行（1 始まり）。超えていなければ null
 */
export function countLines(text) {
  let count = 0;
  let overflowLine = null;
  text.split(/\r?\n/).forEach((line, index) => {
    if (line.trim() === '') return;
    count += 1;
    if (count === LINE_LIMIT) overflowLine = index + 1;
  });
  return { count, overflowLine };
}

/** 行数の違反の直し方 */
export function lineLimitAdvice(count) {
  return `空行を除いて ${count} 行（上限 ${LINE_LIMIT - 1} 行）。責務ごとにファイルを分割する`;
}
