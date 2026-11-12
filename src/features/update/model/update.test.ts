import { describe, expect, it } from 'vitest';
import { INITIAL_UPDATE_STATE, updateNotice, updateSummary, versionToNotify } from './update';

const latest = { version: '0.2.0', notes: '' };

describe('updateSummary', () => {
  it('確かめる前・確認中・最新・新しい版ありを言い分ける', () => {
    expect(updateSummary(INITIAL_UPDATE_STATE)).toBe('まだ確認していません');
    expect(updateSummary({ ...INITIAL_UPDATE_STATE, phase: 'checking' })).toBe('新しい版を確認しています…');
    expect(updateSummary({ ...INITIAL_UPDATE_STATE, status: { currentVersion: '0.1.0', latest: null } })).toBe(
      'いまの版 0.1.0 は最新です',
    );
    expect(updateSummary({ ...INITIAL_UPDATE_STATE, status: { currentVersion: '0.1.0', latest } })).toBe(
      '新しい版 0.2.0 があります（いまは 0.1.0）',
    );
  });

  it('確かめ直しているあいだも、前の結果を出し続ける', () => {
    const state = { phase: 'checking', status: { currentVersion: '0.1.0', latest: null }, error: null } as const;
    expect(updateSummary(state)).toBe('いまの版 0.1.0 は最新です');
  });
});

describe('versionToNotify', () => {
  it('新しい版があれば知らせ、同じ版は二度知らせない。さらに新しい版が出たらまた知らせる', () => {
    const status = { currentVersion: '0.1.0', latest };
    expect(versionToNotify(status, null)).toEqual(latest);
    expect(versionToNotify(status, '0.2.0')).toBeNull();
    expect(versionToNotify(status, '0.1.5')).toEqual(latest);
    expect(updateNotice(latest)).toBe('新しい版 0.2.0 があります');
  });

  it('確かめられなかったとき・最新のときは知らせない', () => {
    expect(versionToNotify(null, null)).toBeNull();
    expect(versionToNotify({ currentVersion: '0.1.0', latest: null }, null)).toBeNull();
  });
});
