// 本文の HTML に置く「差し込み口」（data-embed）。sanitize のあと、MessageBody がここに React の部品を差し込む:
// コードブロックにはコピーのボタン、mermaid には図、画像・動画には読み込みと表示。
// 差し込めなくても（部品が動かなくても）コードは読める形のままにする。
import { escapeHtml } from '@/shared/lib/html';
import { fenceLanguage, highlightCode } from './highlight';
import { bodyMedia } from './mediaUrl';

export const MERMAID_LANGUAGE = 'mermaid';

const FENCE_OPEN = /^ {0,3}(`{3,}|~{3,})/;

/**
 * フェンスが閉じているか。書きかけの発言（閉じていない ```）は、最後まで届くまで図にしない。
 * 字下げのコードブロック（フェンスなし）は閉じているものとして扱う。
 */
export function isClosedFence(raw: string): boolean {
  const open = FENCE_OPEN.exec(raw)?.[1];
  if (open === undefined) return true;
  const lines = raw.trimEnd().split('\n');
  const last = lines.length > 1 ? (lines[lines.length - 1] ?? '').trim() : '';
  return last.length >= open.length && [...last].every((char) => char === open[0]);
}

/** コードブロック。閉じた mermaid は図の差し込み口に、ほかは色分けしたコードにする */
export function codeBlockHtml(code: string, info: string | undefined, raw: string): string {
  const language = fenceLanguage(info);
  const diagram = language === MERMAID_LANGUAGE && isClosedFence(raw);
  const body = diagram ? escapeHtml(code) : highlightCode(code, language);
  const label = language === '' ? '' : `<span class="codeLang">${escapeHtml(language)}</span>`;
  const attributes = `class="codeBlock" data-embed="${diagram ? 'mermaid' : 'code'}" data-lang="${escapeHtml(language)}"`;
  return `<div ${attributes}><div class="codeHead">${label}</div><pre><code class="hljs">${body}</code></pre></div>\n`;
}

/** 画像・動画の差し込み口。欄の中で見せられないものは null（呼び出し側がリンクか文字にする） */
export function mediaHtml(href: string, text: string): string | null {
  const media = bodyMedia(href);
  if (!media) return null;
  return `<span class="bodyMedia" data-embed="${media.kind}" data-src="${escapeHtml(media.src)}" data-alt="${escapeHtml(text)}"></span>`;
}
