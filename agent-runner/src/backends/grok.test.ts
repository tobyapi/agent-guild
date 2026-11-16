import { describe, expect, it } from 'vitest';
import { grokAdapter } from './grok.ts';
import { usablePermissions } from './types.ts';
import type { PermissionKey, Permissions } from '../protocol.ts';
import { runContext, runRequest } from './run.test-support.ts';
import { execute, tools } from './grok/tools.ts';
import { setLanguage, LANGUAGES } from '../i18n.ts';

describe('Grok direct read-only contract', () => {
  it.each(['win32', 'darwin', 'linux'])('%s disables writes and commands for all 256 grants', platform => {
    const previous = process.platform;
    Object.defineProperty(process, 'platform', { value: platform });
    try {
      const info = grokAdapter.info();
      const keys = Object.keys(info.capabilities) as PermissionKey[];
      for (let mask = 0; mask < 256; mask++) {
        const granted = Object.fromEntries(keys.map((key, bit) => [key, Boolean(mask & 1 << bit)])) as Permissions;
        const usable = usablePermissions(granted, info);
        for (const key of keys) expect(usable[key] && !granted[key]).toBe(false);
        expect(usable).toMatchObject({ writeFiles: false, writeAnywhere: false, runCommands: false });
        const definitions = tools({ ...runRequest('grok'), permissions: usable });
        expect(definitions.some(tool => /write|command|memory/i.test(String(tool.name)))).toBe(false);
        expect(definitions.some(tool => tool.type === 'web_search')).toBe(usable.webSearch && usable.webFetch);
      }
      expect(info.unrestricted).toEqual([]);
      expect(info.leakRisks).toHaveLength(4);
    } finally { Object.defineProperty(process, 'platform', { value: previous }); }
  });
  it.each(['write_file', 'run_command', 'update_memory', 'web_search', 'x_search', '__proto__'])('rejects forged %s immediately', async name => {
    await expect(execute(runRequest('grok'), runContext(), name, '{}')).rejects.toMatchObject({ code: 'unsupported_permission' });
  });
  it.each(['read_file', 'read_skill', 'fetch_url'])('rechecks the permission immediately before %s', async name => {
    const request = runRequest('grok');
    request.permissions = Object.fromEntries(Object.keys(request.permissions).map(key => [key, false])) as Permissions;
    await expect(execute(request, runContext(), name, '{}')).rejects.toMatchObject({ code: 'unsupported_permission' });
  });
  it('rejects malformed arguments, unknown skills and cancellation before post', async () => {
    const request = runRequest('grok');
    for (const args of ['{', '[]', '{"text":"ok","extra":true}', '{"text":1}']) {
      await expect(execute(request, runContext(), 'post', args)).rejects.toMatchObject({ code: 'bad_request' });
    }
    await expect(execute(request, runContext(), 'read_skill', '{"name":"unknown"}')).rejects.toMatchObject({ code: 'bad_request' });
    const abort = new AbortController(); abort.abort();
    const context = runContext(abort.signal);
    await expect(execute(request, context, 'post', '{"text":"no"}')).rejects.toThrow();
    expect(context.onPost).not.toHaveBeenCalled();
  });
  it('explains disabled MEMORY and the non-strict per-turn budget in five languages', async () => {
    try {
      for (const language of LANGUAGES) {
        setLanguage(language);
        const description = (await grokAdapter.catalog!()).models[0]!.description;
        expect(description).toContain('MEMORY.md');
        expect(description).toContain('$0.20');
      }
    } finally { setLanguage('ja'); }
  });
});
