import { describe, expect, it, vi } from 'vitest';
import { BackendRegistry } from './backends/registry.ts';
import { BackendError, type BackendAdapter, type BackendDescriptor, type LoginContext } from './backends/types.ts';
import { Dispatcher } from './dispatcher.ts';
import { parseLine } from './line-parser.ts';
import type { RunnerEvent } from './protocol.ts';

const PERMISSIONS = {
  webSearch: true,
  webFetch: true,
  readFiles: true,
  readAnywhere: false,
  writeFiles: false,
  writeAnywhere: false,
  runCommands: false,
  skills: false,
};
const INFO: BackendDescriptor = {
  id: 'fake',
  label: 'Fake',
  capabilities: PERMISSIONS,
  options: [],
  permissionRules: [],
  leakRisks: [],
  canLogin: true,
  midRunPost: null,
};

/** ログインの成り行きを外から決める偽アダプタ（ログインが済むと状態が ready になる） */
function loginAdapter(outcome: (context: LoginContext) => Promise<void>, canLogin = true): BackendAdapter {
  let loggedIn = false;
  return {
    info: () => ({ ...INFO, canLogin }),
    probe: () =>
      Promise.resolve(
        loggedIn
          ? { status: 'ready', statusMessage: '' }
          : { status: 'needs_auth', statusMessage: 'ログインしてください' },
      ),
    run: () => Promise.resolve(''),
    login: async (context) => {
      await outcome(context);
      loggedIn = true;
    },
  };
}

function setup(adapter: BackendAdapter) {
  const events: RunnerEvent[] = [];
  const dispatcher = new Dispatcher({
    registry: new BackendRegistry([adapter]),
    runnerVersion: '0.0.0',
    send: (event) => events.push(event),
    exit: vi.fn(),
  });
  const receive = (value: object): void => dispatcher.receive(parseLine(JSON.stringify(value)));
  return { events, receive };
}

const flush = async (): Promise<void> => {
  for (let i = 0; i < 5; i += 1) await new Promise((resolve) => setImmediate(resolve));
};
const LOGIN = { type: 'login', id: 'login-1', backend: 'fake' };

describe('Dispatcher の login', () => {
  it('ログインが済んだら状態を確かめ直して backends を送り、result（text は空）で終える', async () => {
    const { events, receive } = setup(loginAdapter(() => Promise.resolve()));
    receive(LOGIN);
    await flush();
    expect(events.map((event) => event.type)).toEqual(['backends', 'result']);
    expect(events[0]).toMatchObject({ backends: [{ id: 'fake', status: 'ready', canLogin: true }] });
    expect(events[1]).toEqual({ type: 'result', id: 'login-1', text: '' });
  });

  it('完了しなければ、状態を確かめ直してから error（BackendError の code）で終える', async () => {
    const { events, receive } = setup(
      loginAdapter(() => Promise.reject(new BackendError('auth', '完了しませんでした'))),
    );
    receive(LOGIN);
    await flush();
    expect(events.map((event) => event.type)).toEqual(['backends', 'error']);
    expect(events[1]).toEqual({ type: 'error', id: 'login-1', code: 'auth', message: '完了しませんでした' });
  });

  it('canLogin でないバックエンドと未知のバックエンドは受け付けない', async () => {
    const { events, receive } = setup(loginAdapter(() => Promise.resolve(), false));
    receive(LOGIN);
    receive({ ...LOGIN, id: 'login-2', backend: 'nope' });
    await flush();
    expect(events).toEqual([
      { type: 'error', id: 'login-1', code: 'bad_request', message: 'Fake はアプリからログインできません' },
      { type: 'error', id: 'login-2', code: 'unknown_backend', message: '未知のバックエンドです: nope' },
    ]);
  });

  it('cancel でログインを打ち切り（signal を中断）、cancelled を返す', async () => {
    let aborted = false;
    const waitForAbort = ({ signal }: LoginContext): Promise<void> =>
      new Promise((_resolve, reject) =>
        signal.addEventListener('abort', () => {
          aborted = true;
          reject(new Error('閉じました'));
        }),
      );
    const { events, receive } = setup(loginAdapter(waitForAbort));
    receive(LOGIN);
    receive({ type: 'cancel', id: 'login-1' });
    await flush();
    expect(aborted).toBe(true);
    expect(events.filter((event) => event.type !== 'backends')).toEqual([
      { type: 'error', id: 'login-1', code: 'cancelled', message: '実行を中断しました' },
    ]);
  });
});
