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
