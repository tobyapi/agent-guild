import DOMPurify from 'dompurify';
import type { Config } from 'dompurify';
import { escapeHtml } from '@/shared/lib/html';

const CONFIG: Config = {
  ALLOWED_URI_REGEXP: /^https?:/i,
  ADD_ATTR: ['target'],
  FORBID_TAGS: ['style', 'form', 'button', 'textarea', 'select', 'iframe', 'img', 'video', 'audio'],
};

/**
 * HTML を無害化してから画面に出す（dangerouslySetInnerHTML に渡す前に必ず通す）。
 * DOM のない環境（テストなど）では DOMPurify が働かないので、安全側に倒して全体をエスケープする。
 */
export function sanitizeHtml(html: string): string {
  if (!DOMPurify.isSupported) return escapeHtml(html);
  return DOMPurify.sanitize(html, CONFIG);
}
