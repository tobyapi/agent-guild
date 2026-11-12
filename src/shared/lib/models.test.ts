import { describe, expect, it } from 'vitest';
import type { BackendInfo, ModelSpec } from '@/shared/types/domain';
import { checkEffort, effortFrom, modelSpecOf, withEffort } from './models';

const model = (id: string, efforts: string[]): ModelSpec => ({
  id,
  label: `${id}の名前`,
  description: '',
  efforts,
  defaultEffort: null,
});

const backend: BackendInfo = {
  id: 'claude',
  label: 'Claude',
  models: [model('opus', ['low', 'max']), model('haiku', [])],
  defaultModel: 'opus',
  capabilities: {
    webSearch: true,
    webFetch: true,
    readFiles: true,
    readAnywhere: false,
    writeFiles: true,
    writeAnywhere: true,
    runCommands: true,
    skills: true,
  },
  status: 'ready',
  statusMessage: '',
  options: [],
  permissionRules: [],
  leakRisks: [],
  unrestricted: [],
  midRunPost: 'tool',
  folderScope: null,
  toolsOption: null,
  local: false,
  setup: { install: null, start: null, login: null, apiKey: null },
};

describe('modelSpecOf', () => {
  it('空なら既定のモデル、一覧に無ければ undefined', () => {
    expect(modelSpecOf(backend, '')?.id).toBe('opus');
    expect(modelSpecOf(backend, 'haiku')?.id).toBe('haiku');
    expect(modelSpecOf(backend, 'my-model')).toBeUndefined();
    expect(modelSpecOf({ ...backend, defaultModel: '' }, '')).toBeUndefined();
    expect(modelSpecOf(undefined, 'opus')).toBeUndefined();
  });
});

describe('checkEffort', () => {
  it('モデルが選べる深さだけを通す（空のモデルは既定のモデルで確かめる）', () => {
    expect(checkEffort(backend, 'opus', 'max')).toBeNull();
    expect(checkEffort(backend, '', 'low')).toBeNull();
    expect(checkEffort(backend, 'opus', 'ultra')).toBe('「opusの名前」では推論の深さ「ultra」を選べません');
    expect(checkEffort(backend, 'haiku', 'low')).toBe('「haikuの名前」では推論の深さを選べません');
  });

  it('既定（空）と、一覧に無いモデル・分からないバックエンドは確かめない', () => {
    expect(checkEffort(backend, 'haiku', '')).toBeNull();
    expect(checkEffort(backend, 'my-model', 'ultra')).toBeNull();
    expect(checkEffort(undefined, 'opus', 'ultra')).toBeNull();
  });
});

describe('effortFrom / withEffort', () => {
  it('backendOptions の effort を読み書きする（空なら取り除く）', () => {
    expect(effortFrom({ effort: 'high', maxTurns: 3 })).toBe('high');
    expect(effortFrom({ effort: 3 })).toBe('');
    expect(withEffort({ maxTurns: 3 }, 'high')).toEqual({ maxTurns: 3, effort: 'high' });
    expect(withEffort({ maxTurns: 3, effort: 'high' }, '')).toEqual({ maxTurns: 3 });
  });
});
