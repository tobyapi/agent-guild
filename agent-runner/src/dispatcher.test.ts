import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { BackendRegistry } from './backends/registry.ts';
import { BackendError, type BackendAdapter, type BackendDescriptor } from './backends/types.ts';
import { Dispatcher } from './dispatcher.ts';
import { parseLine } from './line-parser.ts';
import { PROTOCOL_VERSION, type RunnerEvent } from './protocol.ts';

const PERMISSIONS = { webSearch: true, webFetch: true, readFiles: true, writeFiles: false, writeAnywhere: false, runCommands: false, skills: false };
const INFO: BackendDescriptor = {
  id: 'fake',
  label: 'Fake',
  capabilities: PERMISSIONS,
  options: [],
  permissionRules: [],
  leakRisks: [],
  canLogin: false,
  midRunPost: 'tool',
};

/** prompt で振る舞いを変える偽アダプタ */
const fakeAdapter: BackendAdapter = {
  info: () => INFO,
  probe: () => Promise.resolve({ status: 'needs_auth', statusMessage: 'ログインしてください' }),
  run(request, { signal, onActivity, onPost }) {
    onActivity(`作業中: ${request.prompt}`);
    if (request.prompt === 'post') onPost('進捗: 半分まで終わりました');
    // 終わったあとに届く投稿（送られてはいけない）
    if (request.prompt === 'late') setImmediate(() => onPost('遅れて届いた投稿'));
    if (request.prompt === 'hang') {
      return new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(new Error('aborted'))));
    }
    if (request.prompt === 'auth') return Promise.reject(new BackendError('auth', 'ログインしてください'));
    if (request.prompt === 'boom') return Promise.reject(new Error('boom'));
    return Promise.resolve(`echo: ${request.prompt}`);
  },
};
const FAKE_INFO = { ...INFO, status: 'needs_auth', statusMessage: 'ログインしてください', models: [], defaultModel: '' };

const runLine = (id: string, prompt: string, backend = 'fake'): string =>
  JSON.stringify({
    type: 'run', id, backend, workspace: '/ws', stateDir: '/state', readableDirs: [], systemPrompt: '', prompt,
    intent: '', model: '', permissions: PERMISSIONS, skills: [], images: [], options: {},
  });

const settle = (): Promise<void> => new Promise((resolve) => setImmediate(resolve));

function setup() {
  const events: RunnerEvent[] = [];
  const exit = vi.fn();
  const dispatcher = new Dispatcher({
    registry: new BackendRegistry([fakeAdapter]),
    runnerVersion: '9.9.9',
    send: (event) => events.push(event),
    exit,
  });
  const receive = (line: string): void => dispatcher.receive(parseLine(line));
  return { events, exit, dispatcher, receive };
}

describe('Dispatcher', () => {
  // 想定外のエラーのログ（stderr）でテストの出力を汚さない
  let stderr: MockInstance<typeof process.stderr.write>;
  beforeEach(() => {
    stderr = vi.spyOn(process.stderr, 'write').mockReturnValue(true);
  });
  afterEach(() => {
    stderr.mockRestore();
  });

  it('announce は版と状態つきのバックエンド一覧を ready で送る', async () => {
    const { events, dispatcher } = setup();
    await dispatcher.announce();
    expect(events).toEqual([{ type: 'ready', protocolVersion: PROTOCOL_VERSION, runnerVersion: '9.9.9', backends: [FAKE_INFO] }]);
  });

  it('probe は状態を確かめ直して backends を送る', async () => {
    const { events, receive } = setup();
    receive(JSON.stringify({ type: 'probe' }));
    await settle();
    expect(events).toEqual([{ type: 'backends', backends: [FAKE_INFO] }]);
  });

  it('run は activity を中継してから result を返す', async () => {
    const { events, receive } = setup();
    receive(runLine('j1', 'こんにちは'));
    await settle();
    expect(events).toEqual([
      { type: 'activity', id: 'j1', detail: '作業中: こんにちは' },
      { type: 'result', id: 'j1', text: 'echo: こんにちは' },
    ]);
  });

  it('post は終端イベントの前だけ中継し、終わったジョブの post は捨てる', async () => {
    const { events, receive } = setup();
    receive(runLine('j1', 'post'));
    receive(runLine('j2', 'late'));
    await settle();
    expect(events.filter((event) => event.type !== 'activity')).toEqual([
      { type: 'post', id: 'j1', text: '進捗: 半分まで終わりました' },
      { type: 'result', id: 'j1', text: 'echo: post' },
      { type: 'result', id: 'j2', text: 'echo: late' },
    ]);
  });

  it('cancel はアダプタを中断して cancelled を1回だけ返す（中断による失敗はログにも出さない）', async () => {
    const { events, receive } = setup();
    receive(runLine('j1', 'hang'));
    receive(JSON.stringify({ type: 'cancel', id: 'j1' }));
    receive(JSON.stringify({ type: 'cancel', id: 'j1' }));
    await settle();
    expect(events.slice(1)).toEqual([{ type: 'error', id: 'j1', code: 'cancelled', message: '実行を中断しました' }]);
    expect(stderr).not.toHaveBeenCalled();
  });

  it('未知のバックエンドは unknown_backend', () => {
    const { events, receive } = setup();
    receive(runLine('j1', 'x', 'gemini'));
    expect(events).toEqual([{ type: 'error', id: 'j1', code: 'unknown_backend', message: '未知のバックエンドです: gemini' }]);
  });

  it('未知の type は id があれば bad_request、なければ記録だけ。壊れた行は id: null、空行は無視', () => {
    const { events, receive } = setup();
    receive(JSON.stringify({ type: 'pause', id: 'j1' }));
    receive(JSON.stringify({ type: 'pause' }));
    receive('{oops');
    receive('');
    expect(events.map((event) => event.type === 'error' && [event.id, event.code])).toEqual([
      ['j1', 'bad_request'],
      [null, 'bad_request'],
    ]);
    expect(stderr).toHaveBeenCalledOnce();
  });

  it('BackendError の code はそのまま、想定外の例外は internal', async () => {
    const { events, receive } = setup();
    receive(runLine('a', 'auth'));
    receive(runLine('b', 'boom'));
    await settle();
    expect(events.filter((event) => event.type === 'error')).toEqual([
      { type: 'error', id: 'a', code: 'auth', message: 'ログインしてください' },
      { type: 'error', id: 'b', code: 'internal', message: 'boom' },
    ]);
  });

  it('実行中と同じ id の run は bad_request', () => {
    const { events, receive } = setup();
    receive(runLine('j1', 'hang'));
    receive(runLine('j1', 'hang'));
    expect(events.at(-1)).toMatchObject({ type: 'error', id: 'j1', code: 'bad_request' });
  });

  it('shutdown は実行中のジョブを中断して終わり、以後の入力を無視する', async () => {
    const { events, exit, receive, dispatcher } = setup();
    receive(runLine('j1', 'hang'));
    receive(JSON.stringify({ type: 'shutdown' }));
    receive(runLine('j2', 'こんにちは'));
    dispatcher.shutdown();
    await settle();
    expect(exit).toHaveBeenCalledOnce();
    expect(events.slice(1)).toEqual([{ type: 'error', id: 'j1', code: 'cancelled', message: '実行を中断しました' }]);
  });
});
