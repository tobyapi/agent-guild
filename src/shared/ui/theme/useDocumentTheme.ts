import { useSyncExternalStore } from 'react';
import type { Scheme } from '@/shared/theme/types';

function subscribe(notify: () => void): () => void {
  const observer = new MutationObserver(notify);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  return () => observer.disconnect();
}

const read = (): Scheme => (document.documentElement.dataset.theme === 'light' ? 'light' : 'dark');

/** いまのテーマ（<html data-theme>）。切り替わったら描き直せるように追従する */
export function useDocumentTheme(): Scheme {
  return useSyncExternalStore(subscribe, read, () => 'dark');
}
