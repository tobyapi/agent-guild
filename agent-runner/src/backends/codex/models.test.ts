import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { codexCatalog, defaultEffortOf, parseModels } from './models.ts';

const level = (effort: string) => ({ effort, description: '' });

describe('Codex のモデルの一覧（models_cache.json）', () => {
  it('表示するモデルを priority の順に、選べる深さと既定の深さつきで並べ、先頭を既定のモデルにする', () => {
    const home = mkdtempSync(join(tmpdir(), 'guild-codex-home-'));
    const cache = {
      fetched_at: '2026-11-09T00:00:00Z',
      models: [
        { slug: 'gpt-b', display_name: 'GPT-B', priority: 2, visibility: 'list', default_reasoning_level: 'medium', supported_reasoning_levels: [level('medium')] },
        { slug: 'gpt-hidden', display_name: 'Hidden', priority: 0, visibility: 'hide' },
        { slug: 'gpt-a', display_name: 'GPT-A', description: '速い', priority: 1, visibility: 'list', default_reasoning_level: 'low', supported_reasoning_levels: [level('low'), level('high')] },
      ],
    };
    writeFileSync(join(home, 'models_cache.json'), JSON.stringify(cache));
    const catalog = codexCatalog(home);
    expect(catalog).toEqual({
      defaultModel: 'gpt-a',
      models: [
        { id: 'gpt-a', label: 'GPT-A', description: '速い', efforts: ['low', 'high'], defaultEffort: 'low' },
        { id: 'gpt-b', label: 'GPT-B', description: '', efforts: ['medium'], defaultEffort: 'medium' },
      ],
    });
    expect([defaultEffortOf(catalog, 'gpt-b'), defaultEffortOf(catalog, 'unknown')]).toEqual(['medium', undefined]);
  });

  it('一覧がない・読めないときは分からないとする（モデルは自由入力）', () => {
    const home = mkdtempSync(join(tmpdir(), 'guild-codex-home-'));
    expect(codexCatalog(home)).toEqual({ models: [], defaultModel: '' });
    writeFileSync(join(home, 'models_cache.json'), '{ 壊れた JSON');
    expect(codexCatalog(home)).toEqual({ models: [], defaultModel: '' });
    expect(parseModels([{ display_name: 'slug がない' }, 'モデルではない'])).toEqual([]);
  });
});
