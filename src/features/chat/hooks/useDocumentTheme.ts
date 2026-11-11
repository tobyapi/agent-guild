import { useSyncExternalStore } from 'react';
import type { DiagramTheme } from '../model/mermaid';

function subscribe(notify: () => void): () => void {
  const observer = new MutationObserver(notify);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  return () => observer.disconnect();
}

const read = (): DiagramTheme => (document.documentElement.dataset.theme === 'light' ? 'light' : 'dark');

/** いまのテーマ（<html data-theme>）。切り替わったら描き直せるように追従する */
export function useDocumentTheme(): DiagramTheme {
  return useSyncExternalStore(subscribe, read, () => 'dark');
}
