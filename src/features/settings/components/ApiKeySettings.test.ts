import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { ApiKeySettings } from './ApiKeySettings';

vi.mock('../api', () => ({ settingsApi: { backendApiKey: vi.fn() } }));

describe('API key settings initial render', () => {
  it('uses an empty password field for each backend and disables actions until status is known', () => {
    for (const backendId of ['grok', 'muse'] as const) {
      const html = renderToStaticMarkup(createElement(ApiKeySettings, { backendId }));
      expect(html).toContain('type="password"');
      expect(html).toContain('value=""');
      expect(html).toContain('autoComplete="new-password"');
      expect(html).toContain(backendId === 'grok' ? 'XAI_API_KEY' : 'MODEL_API_KEY');
      expect((html.match(/<button[^>]*disabled=""/g) ?? []).length).toBe(2);
    }
  });
});
