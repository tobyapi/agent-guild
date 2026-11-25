import { expect, it } from 'vitest';
import limits from '../../../../contracts/ipc/run-limits.json';
import type { CommandMap } from '../contract';
import { createHarness } from './harness.test-support';

it('stores the same limits as desktop IPC and preserves the previous values on invalid input', async () => {
  const { transport } = await createHarness();
  const unlimited = { timeoutMinutes: null, maxConcurrentJobs: null };
  const chosen = { ...limits, timeoutMinutes: 60 } satisfies CommandMap['get_run_limits']['result'];
  expect(await transport.invoke('get_run_limits', {})).toEqual(unlimited);
  await transport.invoke('set_run_limits', { limits: chosen });
  expect(await transport.invoke('get_run_limits', {})).toEqual(chosen);
  await expect(
    transport.invoke('set_run_limits', { limits: { ...chosen, maxConcurrentJobs: 0 } }),
  ).rejects.toMatchObject({ code: 'validation', field: 'maxConcurrentJobs' });
  expect(await transport.invoke('get_run_limits', {})).toEqual(chosen);
  await transport.invoke('set_run_limits', { limits: unlimited });
  expect(await transport.invoke('get_run_limits', {})).toEqual(unlimited);
});
