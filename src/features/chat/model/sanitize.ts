import DOMPurify from 'dompurify';
import type { Config } from 'dompurify';
import { escapeHtml } from '@/shared/lib/html';
import { installTypographySanitizer } from './typographySanitize';

let typographySanitizerInstalled = false;

const CONFIG: Config = {
  // DOMPurify はこの正規表現を、URL を持つ属性だけでなく「値を問わない」と分かっている属性以外のすべてに当てる
  ALLOWED_URI_REGEXP: /^https?:/i,
  ADD_ATTR: ['target'],
  // 本文の Markdown が出す、URL ではない属性（タスクリストのチェックボックス・番号の始まり・表の列揃え・リンクの開き方）。
  // ここにないと、上の正規表現に合わない値として消える
  ADD_URI_SAFE_ATTR: ['type', 'start', 'align', 'target', 'rel'],
  FORBID_TAGS: ['style', 'form', 'button', 'textarea', 'select', 'iframe', 'img', 'video', 'audio'],
};

/**
 * HTML を無害化してから画面に出す（dangerouslySetInnerHTML に渡す前に必ず通す）。
 * DOM のない環境（テストなど）では DOMPurify が働かないので、安全側に倒して全体をエスケープする。
 */
export function sanitizeHtml(html: string): string {
  if (!DOMPurify.isSupported) return escapeHtml(html);
  if (!typographySanitizerInstalled) {
    installTypographySanitizer();
    typographySanitizerInstalled = true;
  }
  return DOMPurify.sanitize(html, CONFIG);
}
