import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { backendInfo, NO_SETUP } from '@/shared/lib/backends.test-support';
import { ApiKeySettings } from './ApiKeySettings';
import styles from './SettingsDialog.module.css';

vi.mock('../api', () => ({ settingsApi: { backendApiKey: vi.fn() } }));

describe('API key settings initial render', () => {
  it('uses an empty password field for each backend and disables actions until status is known', () => {
    for (const [id, label, envVar] of [
      ['grok', 'Grok', 'XAI_API_KEY'],
      ['muse', 'Muse Spark', 'MODEL_API_KEY'],
    ] as const) {
      const backend = backendInfo({ id, label, setup: { ...NO_SETUP, apiKey: { envVar } } });
      const html = renderToStaticMarkup(createElement(ApiKeySettings, { backend, envVar }));
      expect(html).toContain('type="password"');
      expect(html).toContain('value=""');
      expect(html).toContain('autoComplete="new-password"');
      expect(html).toContain(`環境変数 ${envVar} を使います`);
      expect(html).toContain(`${label} の API キー`);
      expect((html.match(/<button[^>]*disabled=""/g) ?? []).length).toBe(2);
      expect(html).toContain(styles.keyActions);
      expect(html).not.toContain(styles.sectionAction);
    }
  });
});
