import { expect, it } from 'vitest';
import instructions from '../../../../contracts/ipc/global-instructions.json';
import type { CommandMap } from '../contract';
import { createHarness } from './harness.test-support';

it('roundtrips the shared IPC fixture and rejects oversize input without changing it', async () => {
  const mock = await createHarness();
  const value = instructions satisfies CommandMap['get_global_instructions']['result'];
  expect(await mock.transport.invoke('get_global_instructions', {})).toBe('');
  await mock.transport.invoke('set_global_instructions', { instructions: value });
  expect(await mock.transport.invoke('get_global_instructions', {})).toBe(value);
  await expect(
    mock.transport.invoke('set_global_instructions', { instructions: 'a'.repeat(4_001) }),
  ).rejects.toMatchObject({ code: 'validation', field: 'instructions' });
  expect(await mock.transport.invoke('get_global_instructions', {})).toBe(value);
  await mock.transport.invoke('set_global_instructions', { instructions: '' });
  expect(await mock.transport.invoke('get_global_instructions', {})).toBe('');
});
