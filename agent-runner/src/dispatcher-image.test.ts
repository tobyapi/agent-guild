import { describe, expect, it, vi } from 'vitest';
import { BackendRegistry } from './backends/registry.ts';
import { NO_SETUP, BackendError, type BackendAdapter, type BackendDescriptor } from './backends/types.ts';
import { Dispatcher } from './dispatcher.ts';
import { parseLine } from './line-parser.ts';
import type { RunnerEvent } from './protocol.ts';

const NOTHING = {
  webSearch: false,
  webFetch: false,
  readFiles: false,
  readAnywhere: false,
  writeFiles: false,
  writeAnywhere: false,
  runCommands: false,
  skills: false,
};
const INFO: BackendDescriptor = {
  id: 'painter',
  label: 'Painter',
  capabilities: NOTHING,
  options: [],
  permissionRules: [],
  leakRisks: [],
  unrestricted: [],
  midRunPost: null,
  folderScope: null,
  toolsOption: null,
  local: false,
  frameGeneration: true,
  setup: NO_SETUP,
};
const IMAGE = {
  type: 'image',
  id: 'frame-1',
  backend: 'painter',
  workspace: '/w',
  stateDir: '/s',
  systemPrompt: 'sys',
  prompt: 'roses',
  skills: [],
  output: '/s/frame.png',
};

function setup(adapter: BackendAdapter) {
  const events: RunnerEvent[] = [];
  const dispatcher = new Dispatcher({
    registry: new BackendRegistry([adapter]),
    runnerVersion: '0.0.0',
    send: (event) => events.push(event),
    exit: vi.fn(),
  });
  const receive = (value: object): void => dispatcher.receive(parseLine(JSON.stringify(value)));
  return { events, receive, dispatcher };
}

const flush = async (): Promise<void> => {
  for (let i = 0; i < 5; i += 1) await new Promise((resolve) => setImmediate(resolve));
};

const painter = (image: BackendAdapter['image'], info = INFO): BackendAdapter => ({
  info: () => info,
  probe: () => Promise.resolve({ status: 'ready', statusMessage: '' }),
  run: () => Promise.resolve(''),
  image,
});

describe('Dispatcher の image', () => {
  it('アダプタに要求を渡し、途中経過を中継して、終わったら text が空の result を返す', async () => {
    const image = vi.fn<NonNullable<BackendAdapter['image']>>((_request, { onActivity }) => {
      onActivity('描いています');
      return Promise.resolve();
    });
    const { events, receive } = setup(painter(image));
    receive(IMAGE);
    await flush();
    expect(image.mock.calls[0]?.[0]).toEqual(IMAGE);
    expect(events).toEqual([
      { type: 'activity', id: 'frame-1', detail: '描いています' },
      { type: 'result', id: 'frame-1', text: '' },
    ]);
  });

  it('画像ができなければ、アダプタの失敗を error で返す', async () => {
    const { events, receive } = setup(painter(() => Promise.reject(new BackendError('internal', '画像がありません'))));
    receive(IMAGE);
    await flush();
    expect(events).toEqual([{ type: 'error', id: 'frame-1', code: 'internal', message: '画像がありません' }]);
  });

  it('枠の生成を申告しない・image を持たないアダプタは bad_request', async () => {
    for (const adapter of [painter(undefined), painter(() => Promise.resolve(), { ...INFO, frameGeneration: false })]) {
      const { events, receive } = setup(adapter);
      receive(IMAGE);
      await flush();
      expect(events).toMatchObject([{ type: 'error', id: 'frame-1', code: 'bad_request' }]);
    }
  });

  it('cancel で中断し、cancelled を返す', async () => {
    const image = vi.fn<NonNullable<BackendAdapter['image']>>(
      (_request, { signal }) =>
        new Promise((_resolve, reject) => {
          signal.addEventListener('abort', () => reject(new Error('aborted')));
        }),
    );
    const { events, receive } = setup(painter(image));
    receive(IMAGE);
    await flush();
    receive({ type: 'cancel', id: 'frame-1' });
    await flush();
    expect(events).toMatchObject([{ type: 'error', id: 'frame-1', code: 'cancelled' }]);
  });
});
