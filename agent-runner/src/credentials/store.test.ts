import { EventEmitter } from 'node:events';
import { PassThrough, Writable } from 'node:stream';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiKeyEnvironment, credentialStore, manageApiKey } from './store.ts';

const { spawn, saved, requests, control } = vi.hoisted(() => ({
  spawn: vi.fn(),
  saved: new Map<string, string>(),
  requests: [] as Record<string, string>[],
  control: { fail: false },
}));
vi.mock('node:child_process', () => ({ spawn }));

beforeEach(() => {
  vi.stubGlobal(
    'process',
    Object.defineProperty(Object.create(process) as NodeJS.Process, 'platform', { value: 'win32' }),
  );
  saved.clear();
  requests.length = 0;
  control.fail = false;
  spawn.mockImplementation(() => {
    const child = Object.assign(new EventEmitter(), {
      stdout: new PassThrough(),
      stderr: new PassThrough(),
      kill: vi.fn(),
      stdin: new Writable({
        write(chunk, _encoding, callback) {
          const request = JSON.parse(String(chunk)) as { backend: string; action: string; key: string };
          requests.push(request);
          queueMicrotask(() => {
            if (!control.fail) {
              if (request.action === 'set') saved.set(request.backend, request.key);
              if (request.action === 'delete') saved.delete(request.backend);
              child.stdout.write(
                JSON.stringify(request.action === 'get' ? (saved.get(request.backend) ?? null) : null),
              );
            } else child.stderr.write(`sensitive error: ${request.key ?? 'hidden'}`);
            child.emit('close', control.fail ? 1 : 0);
          });
          callback();
        },
      }),
    });
    return child;
  });
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe('OS credential settings', () => {
  it('saves, replaces and deletes independently; status never returns a key', async () => {
    vi.stubEnv('XAI_API_KEY', 'environment-grok');
    await manageApiKey('grok', 'set', 'first-grok');
    await manageApiKey('muse', 'set', 'saved-muse');
    expect(await apiKeyEnvironment('grok')).toHaveProperty('XAI_API_KEY', 'first-grok');
    expect(await manageApiKey('grok', 'set', 'replacement')).toBe('{"source":"saved","supported":true}');
    expect(await apiKeyEnvironment('grok')).toHaveProperty('XAI_API_KEY', 'replacement');
    expect(await manageApiKey('grok', 'delete')).toBe('{"source":"environment","supported":true}');
    expect(await apiKeyEnvironment('grok')).toHaveProperty('XAI_API_KEY', 'environment-grok');
    expect(await apiKeyEnvironment('muse')).toHaveProperty('MODEL_API_KEY', 'saved-muse');
    await manageApiKey('muse', 'delete');
    await manageApiKey('muse', 'delete');
    vi.stubEnv('MODEL_API_KEY', '');
    expect(await manageApiKey('muse', 'status')).toContain('"source":"unset"');
  });
  it('passes secrets via stdin, with a fixed executable and fixed script arguments', async () => {
    const key = 'dummy-$(must-not-run)-`literal`';
    await manageApiKey('grok', 'set', key);
    expect(JSON.stringify(spawn.mock.calls)).not.toContain(key);
    expect(requests[0]).toEqual({ backend: 'grok', action: 'set', key });
    expect(spawn.mock.calls[0]?.[2]).toMatchObject({ windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
  });
  it('does not expose helper failures or fall back when the store is inaccessible', async () => {
    control.fail = true;
    vi.stubEnv('XAI_API_KEY', 'environment-grok');
    await expect(manageApiKey('grok', 'set', 'private-dummy')).rejects.not.toThrow('private-dummy');
    await expect(apiKeyEnvironment('grok')).rejects.toThrow('資格情報');
    control.fail = false;
    expect(await manageApiKey('grok', 'status')).toContain('environment');
  });
  it('serializes operations on each backend, including reads after updates', async () => {
    const first = credentialStore('grok', 'set', 'first');
    const second = credentialStore('grok', 'set', 'second');
    const read = credentialStore('grok', 'get');
    await Promise.all([first, second]);
    expect(await read).toBe('second');
    expect(requests.map((request) => request.action)).toEqual(['set', 'set', 'get']);
  });
  it('rejects invalid keys without starting the credential helper', async () => {
    for (const key of ['', '  ', 'line\nbreak', 'nul\0byte', 'x'.repeat(2561)]) {
      await expect(manageApiKey('muse', 'set', key)).rejects.toThrow('APIキー');
    }
    expect(spawn).not.toHaveBeenCalled();
  });
  it('retains environment auth on other OSes and refuses insecure persistence', async () => {
    vi.stubGlobal(
      'process',
      Object.defineProperty(Object.create(process) as NodeJS.Process, 'platform', { value: 'linux' }),
    );
    expect(await apiKeyEnvironment('muse', { MODEL_API_KEY: 'env-muse' })).toHaveProperty('MODEL_API_KEY', 'env-muse');
    expect(await manageApiKey('muse', 'status')).toContain('"supported":false');
    await expect(manageApiKey('muse', 'set', 'dummy')).rejects.toThrow('Windows');
    expect(spawn).not.toHaveBeenCalled();
  });
});
