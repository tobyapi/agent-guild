import { EventEmitter } from 'node:events';
import type { ClientRequest, IncomingMessage, RequestOptions } from 'node:http';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { lookup } from 'node:dns/promises';
import { request } from 'node:https';
import { fetchURL, publicIP, publicURL } from './fetch-url.ts';

vi.mock('node:dns/promises', () => ({ lookup: vi.fn() }));
vi.mock('node:https', () => ({ request: vi.fn() }));
vi.mock('node:http', () => ({ request: vi.fn() }));
const resolveAddresses = vi.mocked(lookup) as unknown as ReturnType<
  typeof vi.fn<(host: string, options: { all: true }) => Promise<{ address: string; family: number }[]>>
>;
const signal = () => new AbortController().signal;
type Reply = { status?: number; location?: string; encoding?: string; chunks?: Buffer[]; stall?: boolean };
let replies: Reply[];
let destinations: string[];
beforeEach(() => {
  vi.clearAllMocks();
  replies = [{}];
  destinations = [];
  resolveAddresses.mockResolvedValue([{ address: '93.184.216.34', family: 4 }]);
  vi.mocked(request).mockImplementation(((
    url: URL,
    options: RequestOptions,
    callback: (res: IncomingMessage) => void,
  ) => {
    destinations.push(url.hostname);
    const req = new EventEmitter() as ClientRequest;
    req.end = (() => {
      queueMicrotask(() => {
        const reply = replies.shift() ?? {};
        const res = new EventEmitter() as IncomingMessage;
        res.statusCode = reply.status ?? 200;
        res.headers = { location: reply.location, 'content-encoding': reply.encoding };
        res.destroy = () => res;
        callback(res);
        if (!reply.stall) {
          for (const chunk of reply.chunks ?? [Buffer.from('public data')]) res.emit('data', chunk);
          res.emit('end');
        }
      });
      return req;
    }) as typeof req.end;
    options.signal?.addEventListener('abort', () => req.emit('error', new Error('aborted')), { once: true });
    return req;
  }) as typeof request);
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

it.each(['127.1', '0x7f000001', '2130706433', '[::1]', '[::ffff:127.0.0.1]', '169.254.169.254', '10.0.0.1'])(
  'rejects special destination %s',
  async (host) => {
    await expect(fetchURL(`https://${host}/`, signal())).rejects.toThrow();
    expect(request).not.toHaveBeenCalled();
  },
);
it.each(['file:///etc/passwd', 'https://user:pass@example.com', 'https://example.com/\n', 'not a URL'])(
  'rejects unsafe URL %s',
  (raw) => {
    expect(() => publicURL(raw)).toThrow();
  },
);
it.each(['192.168.1.1', '100.64.0.1', '224.0.0.1', '::', 'fc00::1', 'fe80::1', '2001:db8::1', '2002::1'])(
  'rejects non-public IP %s',
  (address) => {
    expect(publicIP(address)).toBe(false);
  },
);
it('pins the validated address without a second DNS lookup', async () => {
  expect(await fetchURL('https://example.com/', signal())).toBe('public data');
  const options = vi.mocked(request).mock.calls[0]![1] as RequestOptions;
  const callback = vi.fn();
  const pinned = options.lookup as (host: string, options: object, cb: typeof callback) => void;
  pinned('attacker-rebinding.example', {}, callback);
  expect(callback).toHaveBeenCalledWith(null, '93.184.216.34', 4);
  expect(lookup).toHaveBeenCalledTimes(1);
});
it('rejects a mixed public/private DNS answer before connecting', async () => {
  resolveAddresses.mockResolvedValue([
    { address: '93.184.216.34', family: 4 },
    { address: '::1', family: 6 },
  ]);
  await expect(fetchURL('https://example.com/', signal())).rejects.toThrow();
  expect(request).not.toHaveBeenCalled();
});
it('revalidates every redirect and rejects public to private', async () => {
  replies = [{ status: 302, location: 'https://127.0.0.1/secret' }];
  await expect(fetchURL('https://example.com/', signal())).rejects.toThrow();
  expect(destinations).toEqual(['example.com']);
});
it('bounds infinite redirects', async () => {
  replies = Array.from({ length: 6 }, () => ({ status: 302, location: '/again' }));
  await expect(fetchURL('https://example.com/', signal())).rejects.toThrow();
  expect(request).toHaveBeenCalledTimes(6);
});
it('rejects streamed oversized or compressed content', async () => {
  replies = [{ chunks: [Buffer.alloc(1024 * 1024), Buffer.alloc(1024 * 1024 + 1)] }];
  await expect(fetchURL('https://example.com/', signal())).rejects.toThrow();
  replies = [{ encoding: 'gzip' }];
  await expect(fetchURL('https://example.com/', signal())).rejects.toThrow();
});
it('propagates cancellation before and during the response', async () => {
  const abort = new AbortController();
  abort.abort();
  await expect(fetchURL('https://example.com/', abort.signal)).rejects.toThrow();
  replies = [{ stall: true }];
  const active = new AbortController();
  const pending = fetchURL('https://example.com/', active.signal);
  await new Promise((resolve) => setImmediate(resolve));
  active.abort();
  await expect(pending).rejects.toThrow();
});

it('stops delayed bodies at the whole-fetch deadline', async () => {
  vi.useFakeTimers();
  vi.spyOn(AbortSignal, 'timeout').mockImplementation((ms) => {
    const abort = new AbortController();
    setTimeout(() => abort.abort(), ms);
    return abort.signal;
  });
  replies = [{ stall: true }];
  const pending = fetchURL('https://example.com/', signal());
  const rejected = expect(pending).rejects.toThrow();
  await vi.advanceTimersByTimeAsync(15000);
  await rejected;
});
