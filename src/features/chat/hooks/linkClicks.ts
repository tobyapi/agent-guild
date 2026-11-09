// 本文のリンクの扱い: WebView の中で遷移させず、OS の既定のブラウザで開く（http・https だけ）。
import type { MouseEvent } from 'react';
import { isExternalUrl } from '@/shared/lib/links';
import { reportError } from '@/shared/ui';
import { chatApi } from '../api';

/** 本文のクリック（中ボタンを含む）がリンクの上なら、既定の動作を止めてブラウザで開く */
export function handleLinkClick(event: MouseEvent<HTMLElement>): void {
  if (!(event.target instanceof Element)) return;
  const link = event.target.closest('a[href]');
  if (!link) return;
  event.preventDefault();
  const href = link.getAttribute('href') ?? '';
  if (isExternalUrl(href)) chatApi.openUrl(href).catch(reportError);
}
