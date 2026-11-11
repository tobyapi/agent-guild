// 本文の HTML（sanitize 済み）から、部品を差し込む口（markdownEmbeds.ts の data-embed）を読み取る。
// 属性は描画側が書いたものだが、ここでもう一度検証する（URL は bodyMedia を通ったものだけを使う）。
import { bodyMedia } from './mediaUrl';
import type { BodyMedia } from './mediaUrl';

export type Embed =
  | { kind: 'code'; target: Element; source: string }
  | { kind: 'mermaid'; target: Element; source: string }
  | { kind: 'media'; target: Element; media: BodyMedia; alt: string };

/** コードブロックには見出しにコピーのボタン、mermaid にはそれに加えて図（ブロックの末尾）を差し込む */
function readCode(element: Element, diagram: boolean): Embed[] {
  const source = element.querySelector('pre > code')?.textContent ?? '';
  const head = element.querySelector('.codeHead');
  const copy: Embed[] = head ? [{ kind: 'code', target: head, source }] : [];
  return diagram ? [...copy, { kind: 'mermaid', target: element, source }] : copy;
}

function readEmbed(element: Element): Embed[] {
  const kind = element.getAttribute('data-embed');
  if (kind === 'code' || kind === 'mermaid') return readCode(element, kind === 'mermaid');
  const media = bodyMedia(element.getAttribute('data-src') ?? '');
  if (!media || media.kind !== kind) return [];
  return [{ kind: 'media', target: element, media, alt: element.getAttribute('data-alt') ?? '' }];
}

/** 本文の中の差し込み口を、文書の順に */
export function findEmbeds(root: Element): Embed[] {
  return [...root.querySelectorAll('[data-embed]')].flatMap(readEmbed);
}
