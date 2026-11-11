import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { checkedPolicy } from './check.ts';
import { fileAccessPolicy } from './permissions.ts';
import { call, home, peer, request, workspace } from './secret-read.test-support.ts';

vi.mock('node:os', async (original) => ({ ...(await original<typeof import('node:os')>()), homedir: () => home }));

function scopedRequest(role: string) {
  const req = request(role);
  return { ...req, permissions: { ...req.permissions, readAnywhere: false, writeAnywhere: false, runCommands: false } };
}

describe('writeAnywhere のない Claude の Glob 起点', () => {
  it.each(['省略', '作業場所'])('path が%sでも絶対 pattern を拒否し、直し方を返す', async (kind) => {
    const input = { pattern: join(home, '.ssh/*'), ...(kind === '作業場所' ? { path: workspace } : {}) };
    for (const role of ['発想役', '作業者']) {
      const req = scopedRequest(role);
      for (const policy of [fileAccessPolicy(req), checkedPolicy(req, vi.fn(), vi.fn())]) {
        const result = await call(policy, 'Glob', input);
        expect(result).toMatchObject({ behavior: 'deny' });
        if (result?.behavior === 'deny') {
          expect(result.message).toContain('path に起点、pattern に相対パターン');
          expect(result.message).not.toContain('狭いフォルダ');
        }
      }
    }
  });

  it.each(['発想役', '作業者'])('%s の相対 pattern は path 省略・作業場所・readableDirs で許可する', async (role) => {
    const req = scopedRequest(role);
    for (const path of [undefined, workspace, peer]) {
      const input = { pattern: '**/*.ts', ...(path ? { path } : {}) };
      for (const policy of [fileAccessPolicy(req), checkedPolicy(req, vi.fn(), vi.fn())]) {
        expect(await call(policy, 'Glob', input)).toMatchObject({ behavior: 'allow', updatedInput: input });
      }
    }
  });

  it.each(['省略', '作業場所'])('writeAnywhere は path が%sでも絶対 pattern を引き続き許可する', async (kind) => {
    const req = request('作業者');
    const input = { pattern: join(home, '.ssh/*'), ...(kind === '作業場所' ? { path: workspace } : {}) };
    for (const policy of [fileAccessPolicy(req), checkedPolicy(req, vi.fn(), vi.fn())]) {
      expect(await call(policy, 'Glob', input)).toMatchObject({ behavior: 'allow', updatedInput: input });
    }
  });
});
