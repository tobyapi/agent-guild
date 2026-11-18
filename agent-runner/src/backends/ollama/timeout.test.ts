import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { Dispatcher } from '../../dispatcher.ts';
import type { RunnerEvent } from '../../protocol.ts';
import { ollamaAdapter } from '../ollama.ts';
import { BackendRegistry } from '../registry.ts';
import { runRequest } from '../run.test-support.ts';
import { localHttp } from './http.ts';

vi.mock('./http.ts', () => ({ localHttp: vi.fn() }));
const http = vi.mocked(localHttp);
const list = { models: [{ model: 'small:1b', capabilities: ['completion'] }] };

beforeEach(() => {
  vi.useFakeTimers();
  http.mockReset().mockResolvedValueOnce({ status: 200, text: JSON.stringify(list) });
});
afterEach(() => vi.useRealTimers());

it.each([
  [{}, 30],
  [{ timeoutMinutes: 0 }, 30],
  [{ timeoutMinutes: 61 }, 30],
  [{ timeoutMinutes: 2.5 }, 30],
  [{ timeoutMinutes: '5' }, 30],
  [{ timeoutMinutes: 1 }, 1],
  [{ timeoutMinutes: 5 }, 5],
  [{ timeoutMinutes: 60 }, 60],
])('Ollama の設定 %j では %d 分でチャット通信を中断する', async (options, minutes) => {
  const abandoned = vi.fn();
  http.mockImplementationOnce((_path, signal) => {
    return new Promise((_resolve, reject) => {
      signal.addEventListener(
        'abort',
        () => {
          abandoned();
          reject(new DOMException('Stopped', 'AbortError'));
        },
        { once: true },
      );
    });
  });
  const events: RunnerEvent[] = [];
  const dispatcher = new Dispatcher({
    registry: new BackendRegistry([ollamaAdapter]),
    runnerVersion: 'test',
    send: (event) => events.push(event),
    exit: vi.fn(),
  });
  dispatcher.receive({ kind: 'message', value: { ...runRequest('ollama'), options } });

  await vi.advanceTimersByTimeAsync(minutes * 60_000 - 1);
  expect(http.mock.calls[1]?.[0]).toBe('/api/chat');
  expect(abandoned).not.toHaveBeenCalled();
  expect(events.some((event) => event.type === 'error')).toBe(false);

  await vi.advanceTimersByTimeAsync(1);
  expect(abandoned).toHaveBeenCalledOnce();
  expect(events.filter((event) => event.type === 'error')).toEqual([
    { id: 'j', type: 'error', code: 'timeout', message: `時間切れで実行を中断しました（${minutes}分）` },
  ]);
});
