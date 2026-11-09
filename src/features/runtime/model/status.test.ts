import { describe, expect, it } from 'vitest';
import type { BackendInfo } from '@/shared/types/domain';
import { backendTitle, runtimeBanner } from './status';

const backend = (overrides: Partial<BackendInfo>): BackendInfo => ({
  id: 'codex',
  label: 'Codex',
  models: [],
  defaultModel: '',
  capabilities: { webSearch: true, webFetch: true, readFiles: true, writeFiles: true, writeAnywhere: true, runCommands: true, skills: true },
  status: 'ready',
  statusMessage: '',
  options: [],
  permissionRules: [],
  leakRisks: [],
  canLogin: false,
  midRunPost: 'text',
  ...overrides,
});

describe('runtimeBanner', () => {
  it('起動中と使えないときだけ帯を出す', () => {
    expect(runtimeBanner({ state: 'starting', message: '' })?.title).toBe('エージェントの実行環境を起動しています…');
    expect(runtimeBanner({ state: 'unavailable', message: 'node が見つかりません' })).toEqual({
      state: 'unavailable',
      title: 'エージェントを動かせません',
      detail: 'node が見つかりません',
    });
    expect(runtimeBanner({ state: 'ready', message: '' })).toBeNull();
  });
});

describe('backendTitle', () => {
  it('案内があれば表示名に続ける', () => {
    expect(backendTitle(backend({ statusMessage: 'codex login を実行してください' }))).toBe(
      'Codex — codex login を実行してください',
    );
    expect(backendTitle(backend({}))).toBe('Codex');
  });
});
