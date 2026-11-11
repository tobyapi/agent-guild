// コードブロックの色分け（highlight.js のよく使う言語）。出力は hljs-* のクラスを持つ span だけで、中身はエスケープ済み。
// 言語が分からないときは推測せず、色を付けない（推測は遅く、外れると読みにくい）。
import hljs from 'highlight.js/lib/common';
import { escapeHtml } from '@/shared/lib/html';

const LANGUAGE_NAME = /^[\w+#.-]{1,24}$/;

/** フェンスの情報行（```ts title=... など）から言語名を取り出す。名前の形でなければ空 */
export function fenceLanguage(info: string | undefined): string {
  const name = (info ?? '').trim().split(/\s+/)[0] ?? '';
  return LANGUAGE_NAME.test(name) ? name.toLowerCase() : '';
}

/** 色分けした HTML（知らない言語・言語なしはエスケープだけ） */
export function highlightCode(code: string, language: string): string {
  if (language === '' || !hljs.getLanguage(language)) return escapeHtml(code);
  try {
    return hljs.highlight(code, { language, ignoreIllegals: true }).value;
  } catch {
    return escapeHtml(code);
  }
}
