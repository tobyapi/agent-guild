import { expect, it, vi } from 'vitest';
import { BackgroundJobs } from './jobs.ts';
import { BackendRegistry } from '../backends/registry.ts';
import { codexAdapter } from '../backends/codex.ts';
import type { RunnerEvent } from '../protocol.ts';

const request = { type: 'background' as const, id: 'background-one', backend: 'artist', prompt: 'quiet lake' };
function setup(background?: (prompt: string, signal: AbortSignal) => Promise<Uint8Array>) {
  const events: RunnerEvent[] = [];
  const registry = new BackendRegistry([
    {
      ...codexAdapter,
      info: () => ({ ...codexAdapter.info(), id: 'artist', frameGeneration: true }),
      probe: () => Promise.resolve({ status: 'ready', statusMessage: '' }),
      background,
    },
  ]);
  return { jobs: new BackgroundJobs(registry, (event) => events.push(event)), events };
}
it('does not infer background support from an image/frame adapter', async () => {
  const { jobs, events } = setup();
  jobs.start(request);
  await vi.waitFor(() => expect(events).toHaveLength(1));
  expect(events[0]).toMatchObject({ type: 'error', code: 'bad_request' });
});
it('returns bounded image bytes and rejects empty and oversized output', async () => {
  for (const size of [3, 0, 5 * 1024 * 1024 + 1]) {
    const render = vi.fn(() => Promise.resolve(new Uint8Array(size)));
    const { jobs, events } = setup(render);
    jobs.start(request);
    await vi.waitFor(() => expect(events).toHaveLength(1));
    expect(render).toHaveBeenCalledWith('quiet lake', expect.any(AbortSignal));
    expect(events[0]).toMatchObject(
      size === 3 ? { type: 'result', text: 'AAAA' } : { type: 'error', code: 'invalid_response' },
    );
  }
});
it('cancellation suppresses late image data and retains ownership until cleanup finishes', async () => {
  let finish!: (bytes: Uint8Array) => void;
  let signal!: AbortSignal;
  const { jobs, events } = setup((_prompt, received) => {
    signal = received;
    return new Promise((resolve) => {
      finish = resolve;
    });
  });
  jobs.start(request);
  await vi.waitFor(() => expect(signal).toBeDefined());
  jobs.cancel('old-id');
  expect(signal.aborted).toBe(false);
  jobs.cancel(request.id);
  expect(signal.aborted).toBe(true);
  jobs.start({ ...request, id: 'second' });
  expect(events[0]).toMatchObject({ id: 'second', type: 'error' });
  finish(new Uint8Array([1]));
  await vi.waitFor(() => expect(events).toHaveLength(2));
  expect(events[1]).toMatchObject({ id: request.id, type: 'error', code: 'cancelled' });
});
