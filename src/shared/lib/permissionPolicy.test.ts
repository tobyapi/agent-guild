import { describe, expect, it } from 'vitest';
import snapshot from '../../../contracts/ipc/snapshot.json';
import cases from '../../../contracts/behavior/role-permissions.json';
import type { AgentTemplate, BackendInfo } from '@/shared/types/domain';
import {
  rolePermissions,
  supportedPermissions,
  unrestrictedPermissions,
  unusablePermissions,
} from './permissionPolicy';

describe('役割で決まる権限と、バックエンドで使える操作（Rust・ランナーと共有の実例）', () => {
  const templates = snapshot.templates as AgentTemplate[];
  for (const example of cases)
    it(example.name, () => {
      const backend = snapshot.backends.find((item) => item.id === example.backend) as BackendInfo;
      const permissions = rolePermissions(templates, example.tags);
      expect(permissions).toEqual(example.permissions);
      expect(supportedPermissions(permissions, backend)).toEqual(example.usable);
    });
  it('権限は役割だけで決まり、どのバックエンドの実例でも同じ', () => {
    for (const example of cases) {
      const same = cases.filter((other) => JSON.stringify(other.tags) === JSON.stringify(example.tags));
      expect(new Set(same.map((other) => other.backend)).size).toBe(same.length);
      for (const other of same) expect(other.permissions).toEqual(example.permissions);
    }
  });
  it('使わない操作には理由を付け、権限を増やす案内はしない', () => {
    const claude = snapshot.backends.find((item) => item.id === 'claude') as BackendInfo;
    const expert = rolePermissions(templates, ['専門家']);
    const unusable = unusablePermissions(expert, claude, '', {});
    expect(unusable.map((item) => item.key)).toEqual(['runCommands']);
    expect(unusable[0]?.reason).toContain('Claudeでは単独で安全に守れないため');
    expect(unusable[0]?.reason).toContain('「作業フォルダの外にも書く」');
    expect(unusablePermissions(rolePermissions(templates, ['作業者']), claude, '', {})).toEqual([]);
    expect(unusablePermissions(expert, undefined, '', {})).toEqual([]);
    const ollama = snapshot.backends.find((item) => item.id === 'ollama') as BackendInfo;
    const model = ollama.models.find((item) => item.tools)?.id ?? ollama.defaultModel;
    const idle = unusablePermissions(expert, ollama, model, {});
    expect(idle.map((item) => item.key)).toContain('readFiles');
    expect(idle.find((item) => item.key === 'readFiles')?.reason).toContain('道具の利用を有効にする');
    expect(idle.find((item) => item.key === 'readAnywhere')?.reason).toContain('道具がありません');
  });
  it('役割で許可していないのに止められない操作を、バックエンドの申告から挙げる', () => {
    const codex = snapshot.backends.find((item) => item.id === 'codex') as BackendInfo;
    const claude = snapshot.backends.find((item) => item.id === 'claude') as BackendInfo;
    expect(unrestrictedPermissions(rolePermissions(templates, ['発想役']), codex)).toEqual(['readAnywhere']);
    expect(unrestrictedPermissions(rolePermissions(templates, []), codex)).toEqual([
      'readAnywhere',
      'writeFiles',
      'runCommands',
    ]);
    expect(unrestrictedPermissions(rolePermissions(templates, ['専門家']), codex)).toEqual([]);
    expect(unrestrictedPermissions(rolePermissions(templates, ['作業者']), codex)).toEqual([]);
    expect(unrestrictedPermissions(rolePermissions(templates, ['発想役']), claude)).toEqual([]);
    expect(unrestrictedPermissions(rolePermissions(templates, ['発想役']), undefined)).toEqual([]);
  });
  it('依存が連鎖していても、許可範囲を拡大せず解決する', () => {
    const backend = {
      ...snapshot.backends[0],
      permissionRules: [
        { when: 'writeAnywhere', requires: ['writeFiles'] },
        { when: 'writeFiles', requires: ['runCommands'] },
      ],
    } as BackendInfo;
    const permissions = { ...rolePermissions(templates, ['作業者']), runCommands: false };
    const resolved = supportedPermissions(permissions, backend);
    expect(resolved).toMatchObject({ writeAnywhere: false, writeFiles: false, runCommands: false });
    expect(permissions.writeAnywhere).toBe(true);
  });
});

it('道具の利用を切り替えるバックエンドは、有効化と対応モデルがそろったときだけ役割の権限を使う', async () => {
  const { modelPermissions } = await import('./permissionPolicy');
  const permissions = rolePermissions(snapshot.templates as AgentTemplate[], ['作業者']);
  const backend: BackendInfo = {
    ...(snapshot.backends[0] as BackendInfo),
    id: 'local',
    toolsOption: 'enableTools',
    capabilities: permissions,
    models: [{ id: 'tools', label: 'tools', description: '', efforts: [], defaultEffort: null, tools: true }],
    defaultModel: 'tools',
  };
  // 切り替えのないバックエンドは、設定にかかわらず役割の権限どおり
  const always = { ...backend, toolsOption: null };
  expect(modelPermissions(permissions, always, 'unknown', {})).toEqual(supportedPermissions(permissions, always));
  expect(Object.values(modelPermissions(permissions, backend, '', {})).every((value) => !value)).toBe(true);
  expect(modelPermissions(permissions, backend, '', { enableTools: true })).toEqual(
    supportedPermissions(permissions, backend),
  );
  expect(
    Object.values(modelPermissions(permissions, backend, 'unknown', { enableTools: true })).every((value) => !value),
  ).toBe(true);
});
