import { expect, it } from 'vitest';
import { createHarness } from './harness.test-support';

it('has an empty background library and explicitly rejects desktop-only operations', async () => {
  const mock = await createHarness();
  await expect(mock.transport.invoke('list_background_images', {})).resolves.toEqual([]);
  for (const command of ['import_background_image', 'get_background_image', 'delete_background_image'] as const) {
    await expect(
      mock.transport.invoke(command, { data: 'cGl4ZWw=', id: '12345678-1234-1234-1234-123456789abc' }),
    ).rejects.toMatchObject({ code: 'unavailable' });
  }
});
