// 本文のリンクは WebView で遷移せず、対象に合う OS の操作に渡す。
import type { MouseEvent } from 'react';
import { isExternalUrl } from '@/shared/lib/links';
import { reportError } from '@/shared/ui';
import { chatApi } from '../api';

/** キーボードの Enter もリンクの click イベントになる。 */
export function handleLinkClick(event: MouseEvent<HTMLElement>): void {
  if (event.button > 1 || !(event.target instanceof Element)) return;
  const link = event.target.closest('a[href]');
  if (!link) return;
  event.preventDefault();
  const path = link.getAttribute('data-local-path');
  if (path !== null) {
    chatApi.openLocalPath(path, event.shiftKey).catch(reportError);
    return;
  }
  const href = link.getAttribute('href') ?? '';
  if (isExternalUrl(href)) chatApi.openUrl(href).catch(reportError);
}
