import { describe, expect, it } from 'vitest';
import type { BackendInfo, Permissions } from '@/shared/types/domain';
import { allCapabilities, BACKENDS } from './fixtures.test-support';
import { effectivePermissions, leakRisk, permissionRuleProblem, permissionText, riskyGrants } from './permissions';

const writerOnly: Permissions = { ...allCapabilities, writeAnywhere: false, runCommands: false };

function find(id: string): BackendInfo {
  const found = BACKENDS.find((backend) => backend.id === id);
  if (!found) throw new Error(`${id} がありません`);
  return found;
}

describe('effectivePermissions', () => {
  it('エージェントの権限をバックエンドの能力で絞る（能力が分からなければ絞らない）', () => {
    const noFetch = { ...allCapabilities, webFetch: false };
    expect(effectivePermissions(allCapabilities, noFetch)).toMatchObject({ webFetch: false, runCommands: true });
    expect(effectivePermissions(writerOnly, undefined)).toEqual(writerOnly);
  });
});

describe('permissionRuleProblem', () => {
  const claude = find('claude');
  const codex = find('codex');

  it('規則に反していて、足りない権限をバックエンドが持つなら permissions の問題にする', () => {
    expect(permissionRuleProblem(codex, writerOnly)).toEqual({
      field: 'permissions',
      message: 'Codexで「ファイルを書く」を使うには「コマンドを実行」も必要です。「コマンドを実行」を許可してください',
    });
    expect(permissionRuleProblem(codex, allCapabilities)).toBeNull();
  });

  it('作業フォルダの外への書き込み: 書き込みが前提。Claude のコマンドの実行に要り、Codex では Web ページを読む権限が要る', () => {
    expect(permissionRuleProblem(claude, { ...writerOnly, writeFiles: false, writeAnywhere: true })).toEqual({
      field: 'permissions',
      message:
        'Claudeで「作業フォルダの外にも書く」を使うには「ファイルを書く」も必要です。「ファイルを書く」を許可してください',
    });
    expect(permissionRuleProblem(claude, { ...writerOnly, runCommands: true })).toEqual({
      field: 'permissions',
      message:
        'Claudeで「コマンドを実行」を使うには「作業フォルダの外にも書く」も必要です。「作業フォルダの外にも書く」を許可してください',
    });
    expect(permissionRuleProblem(codex, { ...allCapabilities, webFetch: false })).toEqual({
      field: 'permissions',
      message:
        'Codexで「作業フォルダの外にも書く」を使うには「Web ページを読む」も必要です。「Web ページを読む」を許可してください',
    });
    expect(permissionRuleProblem(claude, { ...writerOnly, writeAnywhere: true })).toBeNull();
  });

  it('when の権限を使わない・規則を満たす・バックエンドが分からないときは何も出さない', () => {
    expect(permissionRuleProblem(codex, { ...writerOnly, writeFiles: false })).toBeNull();
    expect(permissionRuleProblem(claude, allCapabilities)).toBeNull();
    expect(permissionRuleProblem(undefined, writerOnly)).toBeNull();
  });

  it('when はバックエンドの能力で絞ったあとの権限で判定する', () => {
    const cannotWrite = { ...codex, capabilities: { ...allCapabilities, writeFiles: false } };
    expect(permissionRuleProblem(cannotWrite, writerOnly)).toBeNull();
  });

  it('足りない権限をバックエンドが持たなければ、バックエンドの選び方の問題にする', () => {
    const lacking = { ...claude, capabilities: { ...allCapabilities, webFetch: false } };
    expect(permissionRuleProblem(lacking, allCapabilities)).toEqual({
      field: 'backend',
      message:
        'Claudeで「コマンドを実行」を使うには「Web ページを読む」も必要です。Claudeでは使えないので、別のバックエンドを選んでください',
    });
  });
});

describe('permissionText / riskyGrants', () => {
  it('どの権限にも説明があり、作業フォルダの外への書き込みとコマンドの実行だけ注意書きがある', () => {
    expect(permissionText('runCommands')).toMatchObject({ label: 'コマンドを実行' });
    expect(permissionText('runCommands').warning).not.toBe('');
    expect(permissionText('writeAnywhere')).toMatchObject({ label: '作業フォルダの外にも書く' });
    expect(permissionText('writeAnywhere').warning).not.toBe('');
    expect(permissionText('writeFiles').warning).toBe('');
    expect(permissionText('webFetch')).toMatchObject({ label: 'Web ページを読む', warning: '' });
    expect(permissionText('skills').description).not.toBe('');
  });

  it('注意書きのある権限のうち許可しているものだけを返す', () => {
    expect(riskyGrants(allCapabilities)).toEqual(['writeAnywhere', 'runCommands']);
    expect(riskyGrants(writerOnly)).toEqual([]);
  });
});

describe('leakRisk', () => {
  const reader: Permissions = { ...allCapabilities, writeFiles: false, writeAnywhere: false, runCommands: false };

  it('組がそろったときだけ、その権限を挙げて知らせる', () => {
    expect(leakRisk(find('claude'), reader)).toBeNull();
    expect(leakRisk(find('claude'), { ...reader, writeFiles: true, writeAnywhere: true })).toMatch(
      /^「ファイルを読む」と「作業フォルダの外にも書く」と「Web ページを読む」がそろうと、このパソコンのどのファイルでも読めて/,
    );
    expect(leakRisk(find('codex'), reader)).toMatch(/^Codexでは「Web ページを読む」を許すと、/);
    expect(leakRisk(find('codex'), { ...reader, webFetch: false })).toBeNull();
  });

  it('バックエンドの能力で絞ったあとの権限で判定し、バックエンドが分からなければ何も出さない', () => {
    const noFetch = { ...find('codex'), capabilities: { ...allCapabilities, webFetch: false } };
    expect(leakRisk(noFetch, reader)).toBeNull();
    expect(leakRisk(undefined, allCapabilities)).toBeNull();
  });
});
