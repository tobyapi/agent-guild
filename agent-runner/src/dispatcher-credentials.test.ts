import { describe, expect, it, vi } from 'vitest';
import { BackendRegistry } from './backends/registry.ts';
import { BackendError, type BackendAdapter } from './backends/types.ts';
import { Dispatcher } from './dispatcher.ts';
import { parseLine } from './line-parser.ts';
import type { RunnerEvent } from './protocol.ts';
import { decodeRequest } from './request-decoder.ts';

const { manage } = vi.hoisted(() => ({ manage: vi.fn() }));
vi.mock('./credentials/store.ts', () => ({
  isKeyBackend: (value: unknown) => value === 'grok' || value === 'muse',
  manageApiKey: manage,
}));

const adapter = (id: string): BackendAdapter => ({
  info: () => ({
    id,
    label: id,
    canLogin: false,
    midRunPost: 'text',
    options: [],
    permissionRules: [],
    leakRisks: [],
    unrestricted: [],
    capabilities: {
      webSearch: false,
      webFetch: false,
      readFiles: false,
      readAnywhere: false,
      writeFiles: false,
      writeAnywhere: false,
      runCommands: false,
      skills: false,
    },
  }),
  probe: () => Promise.resolve({ status: 'ready', statusMessage: '' }),
  run: () => Promise.resolve('unused'),
});
const settle = () => new Promise<void>((resolve) => setImmediate(resolve));

describe('credential IPC', () => {
  it('validates the target and action and discards secrets on status/delete', () => {
    for (const backend of ['claude', '../muse', 'Grok']) {
      expect(decodeRequest({ type: 'apiKey', id: 'key', backend, action: 'set', key: 'dummy' }).ok).toBe(false);
    }
    expect(decodeRequest({ type: 'apiKey', id: 'key', backend: 'grok', action: 'get' }).ok).toBe(false);
    expect(decodeRequest({ type: 'apiKey', id: 'key', backend: 'muse', action: 'set', key: 1 }).ok).toBe(false);
    for (const action of ['status', 'delete']) {
      expect(decodeRequest({ type: 'apiKey', id: 'key', backend: 'muse', action, key: 'unwanted' })).toEqual({
        ok: true,
        request: { type: 'apiKey', id: 'key', backend: 'muse', action },
      });
    }
  });
  it('routes mutations and refreshes status without returning secrets', async () => {
    const events: RunnerEvent[] = [];
    manage.mockResolvedValue('{"source":"saved","supported":true}');
    const dispatcher = new Dispatcher({
      registry: new BackendRegistry([adapter('grok'), adapter('muse')]),
      runnerVersion: 'test',
      send: (event) => events.push(event),
      exit: vi.fn(),
    });
    dispatcher.receive(
      parseLine(JSON.stringify({ type: 'apiKey', id: 'key', backend: 'muse', action: 'set', key: 'dummy-secret' })),
    );
    await settle();
    expect(manage).toHaveBeenLastCalledWith('muse', 'set', 'dummy-secret');
    expect(events.map((event) => event.type)).toEqual(['backends', 'result']);
    expect(JSON.stringify(events)).not.toContain('dummy-secret');
    manage.mockRejectedValue(new BackendError('auth', 'Credential store unavailable'));
    dispatcher.receive(parseLine(JSON.stringify({ type: 'apiKey', id: 'failed', backend: 'grok', action: 'delete' })));
    await settle();
    expect(events.at(-1)).toMatchObject({ type: 'error', id: 'failed', code: 'auth' });
  });
  it('does not echo malformed secret JSON in protocol errors', () => {
    const parsed = parseLine('{"type":"apiKey","key":"dummy-secret",INVALID}');
    expect(parsed.kind).toBe('malformed');
    expect(JSON.stringify(parsed)).not.toContain('dummy-secret');
  });
});
