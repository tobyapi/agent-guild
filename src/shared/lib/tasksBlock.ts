// tasks ブロック（マネージャーの割り振り。docs/design.md §7.1）の位置。本文の最初の ```tasks ブロックだけを扱う。
// 読み取り（名前の照合）は Rust の guild-domain の役目。ここでは場所を探すことと、表示のために取り除くことだけをする。

/** 開きの囲み: 行頭の空白は3つまで、バッククォート3つ以上のあとに tasks */
const OPEN = /^ {0,3}(`{3,})[ \t]*tasks[ \t]*$/;

export interface TasksBlock {
  /** 囲みの中の行 */
  lines: string[];
  /** 本文の行の範囲（囲みの行を含む）。end は含まない */
  start: number;
  end: number;
}

const splitLines = (content: string) => content.split(/\r?\n/);

/** 閉じの囲み: 開きと同じ数以上のバッククォートだけの行 */
function isClosing(line: string, fence: string): boolean {
  const trimmed = line.trim();
  return trimmed.length >= fence.length && /^`+$/.test(trimmed) && line.length - line.trimStart().length <= 3;
}

/** 最初の ```tasks ブロック（閉じがなければ本文の終わりまで）。なければ null */
export function findTasksBlock(content: string): TasksBlock | null {
  const lines = splitLines(content);
  const start = lines.findIndex((line) => OPEN.test(line));
  if (start < 0) return null;
  const fence = OPEN.exec(lines[start] ?? '')?.[1] ?? '```';
  const close = lines.findIndex((line, index) => index > start && isClosing(line, fence));
  const end = close < 0 ? lines.length : close + 1;
  return { lines: lines.slice(start + 1, close < 0 ? lines.length : close), start, end };
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
