import { expect, it } from 'vitest';
import home from '../../../../contracts/ipc/worktree-home.json';
import type { CommandMap } from '../contract';
import { createHarness } from './harness.test-support';

it('mock worktree home keeps the contract shape, rejects relative paths and clears to the default', async () => {
  const value = home satisfies CommandMap['get_worktree_home']['result'];
  const mock = await createHarness();
  const initial = await mock.transport.invoke('get_worktree_home', {});
  expect(initial.path).toBeNull();
  expect(initial.defaultPath.endsWith('worktrees')).toBe(true);
  await mock.transport.invoke('set_worktree_home', { path: value.path });
  expect((await mock.transport.invoke('get_worktree_home', {})).path).toBe(value.path);
  await expect(mock.transport.invoke('set_worktree_home', { path: 'relative' })).rejects.toMatchObject({
    field: 'path',
  });
  await mock.transport.invoke('set_worktree_home', { path: '  ' });
  expect((await mock.transport.invoke('get_worktree_home', {})).path).toBeNull();
});
