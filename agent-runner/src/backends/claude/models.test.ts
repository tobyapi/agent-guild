import type { ModelInfo } from '@anthropic-ai/claude-agent-sdk';
import { describe, expect, it } from 'vitest';
import { toModelSpecs } from './models.ts';

const info = (value: string, displayName: string, efforts?: ModelInfo['supportedEffortLevels']): ModelInfo => ({
  value,
  displayName,
  description: `${displayName} の説明`,
  ...(efforts ? { supportsEffort: true, supportedEffortLevels: efforts } : {}),
});

describe('Claude Code のモデルの一覧', () => {
  it('「default」を除き、選べる深さつきで並べる（深さがなければ空）', () => {
    const models = [
      info('default', 'Default (recommended)', ['low', 'medium']),
      info('opus', 'Opus 5.5', ['low', 'medium', 'high', 'xhigh', 'max']),
      info('claude-haiku-4-5-20251001', 'Haiku 4.5'),
    ];
    expect(toModelSpecs(models)).toEqual([
      { id: 'opus', label: 'Opus 5.5', description: 'Opus 5.5 の説明', efforts: ['low', 'medium', 'high', 'xhigh', 'max'], defaultEffort: null },
      { id: 'claude-haiku-4-5-20251001', label: 'Haiku 4.5', description: 'Haiku 4.5 の説明', efforts: [], defaultEffort: null },
    ]);
  });
});
