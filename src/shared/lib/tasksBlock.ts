// tasks ブロック（マネージャーの割り振り。docs/design.md §7.1）の位置。本文の最初の ```tasks ブロックだけを扱う。
// 見つけ方は Rust の guild-domain（delegation/tasks.rs の tasks_block）と同じ規則にそろえる
// （contracts/behavior/tasks.json で両方を検査する）:
// - 開始行は ``` のあとに tasks（大文字と小文字を区別しない。前後の空白は許す）
// - ほかのコードブロックの中にある ```tasks は読まない
// - 閉じは ``` だけの行。閉じていなければ本文の終わりまで
// ここでは場所を探すことと、表示のために取り除くことだけをする（名前の照合は Rust の役目）。

const FENCE = '```';

export interface TasksBlock {
  /** 囲みの中の行 */
  lines: string[];
  /** 本文の行の範囲（囲みの行を含む）。end は含まない */
  start: number;
  end: number;
}

const splitLines = (content: string) => content.split(/\r?\n/);

/** 囲みの行なら、``` のあとに書かれた文字（前後の空白は除く）。囲みの行でなければ null */
function fenceInfo(line: string): string | null {
  const trimmed = line.trim();
  return trimmed.startsWith(FENCE) ? trimmed.slice(FENCE.length).trim() : null;
}

/** start 行目から始まる tasks ブロック（閉じがなければ本文の終わりまで） */
function blockFrom(lines: string[], start: number): TasksBlock {
  const close = lines.findIndex((line, index) => index > start && line.trim() === FENCE);
  const end = close < 0 ? lines.length : close + 1;
  return { lines: lines.slice(start + 1, close < 0 ? lines.length : close), start, end };
}

/** 最初の ```tasks ブロック。なければ null */
export function findTasksBlock(content: string): TasksBlock | null {
  const lines = splitLines(content);
  let inOtherBlock = false;
  for (const [index, line] of lines.entries()) {
    const info = fenceInfo(line);
    if (info === null) continue;
    // ほかのコードブロックの中では、``` だけの行で閉じる（``` のあとに文字がある行は中身とみなす）
    if (inOtherBlock) inOtherBlock = info !== '';
    else if (info.toLowerCase() === 'tasks') return blockFrom(lines, index);
    else inOtherBlock = true;
  }
  return null;
}

/** 表示用に最初の tasks ブロックを取り除く（タスクのカードに置き換えるとき）。前後の余分な空行もまとめる */
export function removeTasksBlock(content: string): string {
  const block = findTasksBlock(content);
  if (!block) return content;
  const lines = splitLines(content);
  return [...lines.slice(0, block.start), ...lines.slice(block.end)]
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
