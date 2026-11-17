import { expect, it } from 'vitest';
import { createHarness } from './harness.test-support';

it('has an empty background library and explicitly rejects desktop-only operations', async () => {
  const mock = await createHarness();
  await expect(mock.transport.invoke('list_background_images', {})).resolves.toEqual([]);
  await expect(
    mock.transport.invoke('generate_background_image', {
      requestId: 'background-test',
      backendId: 'codex',
      description: 'lake',
    }),
  ).rejects.toMatchObject({ code: 'unavailable' });
  await expect(
    mock.transport.invoke('cancel_background_generation', { requestId: 'background-test' }),
  ).resolves.toBeNull();
  for (const command of ['import_background_image', 'get_background_image', 'delete_background_image'] as const) {
    await expect(
      mock.transport.invoke(command, { data: 'cGl4ZWw=', id: '12345678-1234-1234-1234-123456789abc' }),
    ).rejects.toMatchObject({ code: 'unavailable' });
  }
});
