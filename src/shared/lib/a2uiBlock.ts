// a2ui ブロック（AI が人間に選択肢を尋ねるときに付ける A2UI v1.0 の JSON。docs/design.md §7.2）の位置。
// 本文の最上位にある ```a2ui だけを扱う（tasks ブロックと同じ見つけ方。shared/lib/tasksBlock.ts）:
// - 開始行は ``` のあとに a2ui（大文字と小文字を区別しない。前後の空白は許す）
// - ほかのコードブロックの中・引用（> で始まる行）の中にある ```a2ui は読まない
// - 閉じは ``` だけの行。閉じていなければ本文の終わりまで
// Rust はこのブロックを読まない（表示と押したときの送信は画面側だけ）。

const FENCE = '```';
const LANGUAGE = 'a2ui';

export interface A2uiBlock {
  /** 囲みの中の文字（行を \n でつないだもの） */
  body: string;
  /** 本文の行の範囲（囲みの行を含む）。end は含まない */
  start: number;
  end: number;
  closed: boolean;
}

export type A2uiBlockSearch = { kind: 'none' } | { kind: 'one'; block: A2uiBlock } | { kind: 'many' };

const splitLines = (content: string) => content.split(/\r?\n/);

/** 囲みの行なら、``` のあとに書かれた文字（前後の空白は除く）。囲みの行でなければ null */
function fenceInfo(line: string): string | null {
  const trimmed = line.trim();
  return trimmed.startsWith(FENCE) ? trimmed.slice(FENCE.length).trim() : null;
}

function blockFrom(lines: string[], start: number): A2uiBlock {
  const close = lines.findIndex((line, index) => index > start && line.trim() === FENCE);
  const closed = close >= 0;
  const bodyEnd = closed ? close : lines.length;
  return { body: lines.slice(start + 1, bodyEnd).join('\n'), start, end: closed ? close + 1 : lines.length, closed };
}

/** 最上位の a2ui ブロックをすべて探す */
function findAll(lines: string[]): A2uiBlock[] {
  const found: A2uiBlock[] = [];
  let inOtherBlock = false;
  for (let index = 0; index < lines.length; index += 1) {
    const info = fenceInfo(lines[index] ?? '');
    if (info === null) continue;
    // ほかのコードブロックの中では、``` だけの行で閉じる（``` のあとに文字がある行は中身とみなす）
    if (inOtherBlock) inOtherBlock = info !== '';
    else if (info.toLowerCase() === LANGUAGE) {
      const block = blockFrom(lines, index);
      found.push(block);
      index = block.end - 1;
    } else inOtherBlock = true;
  }
  return found;
}

/** 最上位の a2ui ブロック。ちょうど1つなら one（閉じているかは block.closed）、2つ以上なら many */
export function findA2uiBlock(content: string): A2uiBlockSearch {
  const found = findAll(splitLines(content));
  const [first] = found;
  if (!first) return { kind: 'none' };
  return found.length === 1 ? { kind: 'one', block: first } : { kind: 'many' };
}

/** 表示用に a2ui ブロックを取り除く（ボタンや代わりの表示に置き換えるとき）。前後の余分な空行もまとめる */
export function removeA2uiBlock(content: string, block: A2uiBlock): string {
  const lines = splitLines(content);
  return [...lines.slice(0, block.start), ...lines.slice(block.end)]
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
