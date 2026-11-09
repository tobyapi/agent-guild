import { describe, expect, it } from 'vitest';
import { runSetup, setupPlan } from './setup';

describe('setupPlan', () => {
  it('変えた名前と保存先だけを保存する', () => {
    expect(setupPlan(' リサ ', 'ユーザー', null, 'copy')).toEqual({ name: 'リサ', dataDir: null });
    expect(setupPlan('ユーザー', 'ユーザー', 'D:/Guild', 'copy')).toEqual({
      name: null,
      dataDir: { path: 'D:/Guild', mode: 'copy' },
    });
  });

  it('その場所のデータを開くなら、名前はそのデータのものなので保存しない', () => {
    expect(setupPlan('リサ', 'ユーザー', 'D:/Guild', 'open')).toEqual({
      name: null,
      dataDir: { path: 'D:/Guild', mode: 'open' },
    });
  });
});

describe('runSetup', () => {
  const recorder = () => {
    const calls: string[] = [];
    const steps = {
      saveName: (name: string) => Promise.resolve(calls.push(`name:${name}`)),
      complete: () => Promise.resolve(calls.push('complete')),
      changeDataDir: (path: string, mode: string) => Promise.resolve(calls.push(`dataDir:${path}:${mode}`)),
    };
    return { calls, steps };
  };

  it('名前 → 終えた印 → 保存先の変更（再起動する）の順に保存する', async () => {
    const { calls, steps } = recorder();
    await runSetup({ name: 'リサ', dataDir: { path: 'D:/Guild', mode: 'copy' } }, steps);
    expect(calls).toEqual(['name:リサ', 'complete', 'dataDir:D:/Guild:copy']);
  });

  it('変えていないものは保存しない', async () => {
    const { calls, steps } = recorder();
    await runSetup({ name: null, dataDir: null }, steps);
    expect(calls).toEqual(['complete']);
  });
});
