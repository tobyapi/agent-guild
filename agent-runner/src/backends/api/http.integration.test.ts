import { createServer, type IncomingHttpHeaders, type Server } from 'node:http';
import { once } from 'node:events';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiKeyEnvironment } from '../../credentials/store.ts';
import { runRequest, runContext } from '../run.test-support.ts';
import { providers, textEvents, callEvents } from './provider.test-support.ts';
import type { Item } from './json.ts';

vi.mock('../../credentials/store.ts', () => ({ apiKeyEnvironment: vi.fn() }));
const nativeFetch = fetch;
const servers: Server[] = [];
beforeEach(() =>
  vi.mocked(apiKeyEnvironment).mockResolvedValue({ DEEPSEEK_API_KEY: 'wire-deepseek', GEMINI_API_KEY: 'wire-gemini' }),
);
afterEach(async () => {
  vi.unstubAllGlobals();
  for (const server of servers.splice(0)) {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
async function listen(server: Server): Promise<string> {
  servers.push(server);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('No local port');
  const local = `http://127.0.0.1:${address.port}`;
  vi.stubGlobal(
    'fetch',
    vi.fn<typeof fetch>().mockImplementation((_url, options) => nativeFetch(local, options)),
  );
  return local;
}
describe.each(providers)('$id local HTTP wire', ({ id, adapter }) => {
  it('streams split UTF-8 and completes a signed tool continuation over a real loopback socket', async () => {
    const received: Array<{ body: Item; headers: IncomingHttpHeaders }> = [];
    await listen(
      createServer((req, res) => {
        const chunks: Buffer[] = [];
        req.on('data', (chunk: Buffer) => chunks.push(chunk));
        req.on('end', () => {
          received.push({ body: JSON.parse(Buffer.concat(chunks).toString()) as Item, headers: req.headers });
          const values = received.length === 1 ? callEvents(id) : textEvents(id, '回答です');
          const wire = Buffer.from(
            values.map((value) => `data: ${typeof value === 'string' ? value : JSON.stringify(value)}\n\n`).join(''),
          );
          res.writeHead(200, { 'Content-Type': 'text/event-stream' });
          let offset = 0;
          const next = () => {
            if (offset >= wire.length) {
              res.end();
              return;
            }
            res.write(wire.subarray(offset, offset + 7));
            offset += 7;
            setImmediate(next);
          };
          next();
        });
      }),
    );
    const context = runContext();
    expect(await adapter.run(runRequest(id), context)).toBe('回答です');
    expect(context.onPost).toHaveBeenCalledExactlyOnceWith('progress');
    expect(received).toHaveLength(2);
    const headers = received[0]!.headers;
    expect(headers[id === 'deepseek' ? 'authorization' : 'x-goog-api-key']).toContain(`wire-${id}`);
    expect(headers[id === 'deepseek' ? 'x-goog-api-key' : 'authorization']).toBeUndefined();
    expect(JSON.stringify(received.map((value) => value.body))).not.toContain('wire-');
    expect(JSON.stringify(received[1]!.body)).toContain(id === 'deepseek' ? 'private-thought' : 'opaque-signature');
  });
  it('fails on a socket cut before a complete tool response without posting', async () => {
    await listen(
      createServer((_req, res) => {
        res.writeHead(200, { 'Content-Type': 'text/event-stream' });
        res.write('data: {"partial":');
        setImmediate(() => res.destroy());
      }),
    );
    const context = runContext();
    await expect(adapter.run(runRequest(id), context)).rejects.toThrow();
    expect(context.onPost).not.toHaveBeenCalled();
  });
});
