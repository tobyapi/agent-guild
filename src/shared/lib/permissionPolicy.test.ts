import { describe, expect, it } from 'vitest';
import snapshot from '../../../contracts/ipc/snapshot.json';
import cases from '../../../contracts/behavior/role-permissions.json';
import type { AgentTemplate, BackendInfo } from '@/shared/types/domain';
import { rolePermissions, supportedPermissions } from './permissionPolicy';

describe('役割の固定権限（Rust と共有の実例）', () => {
  const templates = snapshot.templates as AgentTemplate[];
  for (const example of cases)
    it(example.name, () => {
      const backend = snapshot.backends.find((item) => item.id === example.backend) as BackendInfo;
      expect(supportedPermissions(rolePermissions(templates, example.tags), backend)).toEqual(example.permissions);
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

it('Ollama は有効化と対応モデルがそろったときだけ役割の権限を使う', async () => {
  const { modelPermissions } = await import('./permissionPolicy');
  const permissions = rolePermissions(snapshot.templates as AgentTemplate[], ['作業者']);
  const backend: BackendInfo = {
    ...(snapshot.backends[0] as BackendInfo),
    id: 'ollama',
    capabilities: permissions,
    models: [{ id: 'tools', label: 'tools', description: '', efforts: [], defaultEffort: null, tools: true }],
    defaultModel: 'tools',
  };
  expect(Object.values(modelPermissions(permissions, backend, '', {})).every((value) => !value)).toBe(true);
  expect(modelPermissions(permissions, backend, '', { enableTools: true })).toEqual(
    supportedPermissions(permissions, backend),
  );
  expect(
    Object.values(modelPermissions(permissions, backend, 'unknown', { enableTools: true })).every((value) => !value),
  ).toBe(true);
});
