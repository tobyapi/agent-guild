import { describe, expect, it } from 'vitest';
import { MOCK_TEMPLATES } from './seedTemplates';

const fixtures = import.meta.glob<{ templates: unknown }>('/contracts/ipc/snapshot.json', { eager: true, import: 'default' });

describe('モックのテンプレート', () => {
  it('契約の実例（contracts/ipc/snapshot.json）の7つと同じ', () => {
    expect(MOCK_TEMPLATES).toEqual(fixtures['/contracts/ipc/snapshot.json']?.templates);
  });
});
