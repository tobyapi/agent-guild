import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiKeyEnvironment } from '../../credentials/store.ts';
import { runRequest, runContext } from '../run.test-support.ts';
import { providers, events, textEvents, callEvents, mockFetch, requestBody } from './provider.test-support.ts';
import { usableRequest, usablePermissions } from '../types.ts';
import type { Permissions, PermissionKey } from '../../protocol.ts';
import { tools } from './tools.ts';

vi.mock('../../credentials/store.ts', () => ({ apiKeyEnvironment: vi.fn() }));
beforeEach(() => {
  vi.mocked(apiKeyEnvironment).mockResolvedValue({ DEEPSEEK_API_KEY: 'synthetic', GEMINI_API_KEY: 'synthetic' });
});
afterEach(() => vi.unstubAllGlobals());

describe.each(providers)('$id continuation', ({ id, adapter }) => {
  it('preserves opaque continuation and calls once; isolates the next run history', async () => {
    const fetcher = mockFetch(id);
    fetcher.mockResolvedValueOnce(events(callEvents(id)));
    const context = runContext();
    expect(await adapter.run(runRequest(id), context)).toBe('hello back');
    expect(context.onPost).toHaveBeenCalledExactlyOnceWith('progress');
    const body = JSON.stringify(requestBody(fetcher, 1));
    expect(body).toContain(id === 'deepseek' ? 'private-thought' : 'opaque-signature');
    expect(body).toContain('posted');
    expect(body).toContain('call-1');
    expect(JSON.stringify(vi.mocked(context.onPost).mock.calls)).not.toMatch(/private-thought|opaque-signature/);
    await adapter.run(runRequest(id), runContext());
    expect(JSON.stringify(requestBody(fetcher, 2))).not.toMatch(/private-thought|opaque-signature|call-1/);
  });
  it('rejects duplicate IDs and conflicting calls without double posting', async () => {
    const fetcher = mockFetch(id);
    fetcher.mockResolvedValueOnce(events(callEvents(id))).mockResolvedValueOnce(events(callEvents(id)));
    const context = runContext();
    await expect(adapter.run(runRequest(id), context)).rejects.toMatchObject({ code: 'internal' });
    expect(context.onPost).toHaveBeenCalledTimes(1);
  });
  it('checks a whole tool batch before effects, refuses forbidden and malformed calls', async () => {
    for (const call of [
      { id: 'bad', name: 'run_command', args: '{}' },
      { id: 'bad', name: 'read_file', args: '{"path":"x"}' },
      { id: 'bad', name: 'read_skill', args: '{"name":"x"}' },
      { id: 'bad', name: 'post', args: '{"text":1}' },
    ]) {
      const fetcher = mockFetch(id);
      fetcher.mockResolvedValueOnce(
        events(callEvents(id, [{ id: 'first', name: 'post', args: '{"text":"must not post"}' }, call])),
      );
      const request = runRequest(id);
      request.permissions.readFiles = false;
      request.permissions.skills = false;
      const context = runContext();
      await expect(adapter.run(request, context)).rejects.toThrow();
      expect(context.onPost).not.toHaveBeenCalled();
    }
  });
  it('observes only successful SKILL.md reads and keeps used-skill text as a separate declaration', async () => {
    const fetcher = mockFetch(id);
    fetcher.mockResolvedValueOnce(
      events(callEvents(id, [{ id: 'skill-1', name: 'read_skill', args: '{"name":"demo"}' }])),
    );
    const request = runRequest(id);
    request.skills = [{ name: 'demo', description: 'sample', body: '# Demo', dir: null, files: [] }];
    const context = { ...runContext(), onSkillRead: vi.fn() };
    await adapter.run(request, context);
    expect(context.onSkillRead.mock.calls).toEqual([[null], ['demo', 'backend:skill-1']]);
    expect(JSON.stringify(requestBody(fetcher, 1))).toContain('# Demo');
    const noRead = { ...runContext(), onSkillRead: vi.fn() };
    fetcher.mockResolvedValueOnce(events(textEvents(id, 'Used skill: demo')));
    await adapter.run(request, noRead);
    expect(noRead.onSkillRead.mock.calls).toEqual([[null]]);
  });
  it('never widens any of 256 grants and exposes only permitted read tools', () => {
    const info = adapter.info();
    const keys = Object.keys(info.capabilities) as PermissionKey[];
    for (let mask = 0; mask < 256; mask++) {
      const grants = Object.fromEntries(keys.map((key, bit) => [key, Boolean(mask & (1 << bit))])) as Permissions;
      const effective = usablePermissions(grants, info);
      for (const key of keys) expect(effective[key] && !grants[key]).toBe(false);
      expect(effective).toMatchObject({
        writeFiles: false,
        writeAnywhere: false,
        runCommands: false,
        webSearch: false,
      });
      const names = tools(usableRequest({ ...runRequest(id), permissions: grants }, info)).map((tool) => tool.name);
      expect(names.includes('read_file')).toBe(effective.readFiles);
      expect(names.includes('read_skill')).toBe(effective.skills);
      expect(names.includes('fetch_url')).toBe(effective.webFetch);
    }
  });
  it('stops after cancellation between tool effects, with no later post or HTTP', async () => {
    const fetcher = mockFetch(id);
    fetcher.mockResolvedValueOnce(
      events(
        callEvents(id, [
          { id: 'one', name: 'post', args: '{"text":"first"}' },
          { id: 'two', name: 'post', args: '{"text":"late"}' },
        ]),
      ),
    );
    const abort = new AbortController();
    const context = { ...runContext(abort.signal), onPost: vi.fn(() => abort.abort()) };
    await expect(adapter.run(runRequest(id), context)).rejects.toThrow();
    expect(context.onPost).toHaveBeenCalledTimes(1);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
