import { describe, expect, it } from 'vitest';
import { BACKENDS } from './fixtures.test-support';
import { defaultEffortLabel, defaultModelLabel } from './models';

const [claude, codex] = BACKENDS;

describe('既定の選択肢の名前', () => {
  it('モデルは既定のモデルの名前、なければバックエンドに任せる', () => {
    expect(claude && defaultModelLabel(claude)).toBe('既定（Sonnet）');
    expect(codex && defaultModelLabel(codex)).toBe('既定（バックエンドに任せる）');
    expect(claude && defaultModelLabel({ ...claude, defaultModel: 'opus' })).toBe('既定（opus）');
  });

  it('推論の深さはモデルの既定、なければモデルに任せる', () => {
    const spec = { id: 'm', label: 'M', description: '', efforts: ['low'], defaultEffort: null };
    expect(defaultEffortLabel(spec)).toBe('既定（モデルに任せる）');
    expect(defaultEffortLabel({ ...spec, defaultEffort: 'low' })).toBe('既定（low）');
  });
});
