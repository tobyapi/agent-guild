// 指定フォルダのチャンネルの依頼（writableDirs つき）は、範囲の守り方を申告したアダプタだけに届く。
// 内蔵のアダプタでは、Ollama と Codex 系（Codex・Grok・Muse）が受け、Claude は理由を付けて断る。
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createBuiltinRegistry, BackendRegistry } from './backends/registry.ts';
import { BackendError, type BackendAdapter, type RunRequest } from './backends/types.ts';
import { Dispatcher } from './dispatcher.ts';
import { parseLine } from './line-parser.ts';
import type { Permissions, RunnerEvent } from './protocol.ts';

const WORK = resolve('/data/agents/a1/channels/c1/work');
const FOLDER = resolve('/projects/site');

/** 指定フォルダで Rust が渡す権限（PC 全体の読み書きとスキルは外してある。コマンドは Codex 系でだけ残る） */
const SCOPED: Permissions = {
  webSearch: false,
  webFetch: false,
  readFiles: true,
  readAnywhere: false,
  writeFiles: true,
  writeAnywhere: false,
  runCommands: false,
  skills: false,
};

const adapter = (id: string, seen: RunRequest[], folderScope?: BackendAdapter['folderScope']): BackendAdapter => ({
  info: () => ({
    id,
    label: id,
    capabilities: { ...SCOPED, runCommands: true },
    options: [],
    permissionRules: [],
    leakRisks: [],
    unrestricted: [],
    canLogin: false,
    midRunPost: null,
  }),
  probe: () => Promise.resolve({ status: 'ready', statusMessage: '' }),
  run(request) {
    seen.push(request);
    return Promise.resolve('ok');
  },
  ...(folderScope ? { folderScope } : {}),
});

function setup() {
  const seen: RunRequest[] = [];
  const events: RunnerEvent[] = [];
  const refuse = (): void => {
    throw new BackendError('unsupported_permission', 'この PC では範囲を守れません');
  };
  const dispatcher = new Dispatcher({
    registry: new BackendRegistry([
      adapter('scoped', seen, () => {}),
      adapter('refusing', seen, refuse),
      adapter('plain', seen),
    ]),
    runnerVersion: '9.9.9',
    send: (event) => events.push(event),
    exit: () => {},
  });
  const run = (backend: string, scope: object): void =>
    dispatcher.receive(
      parseLine(
        JSON.stringify({
          type: 'run',
          id: `job-${backend}`,
          backend,
          workspace: WORK,
          stateDir: resolve('/data/agents/a1/state'),
          readableDirs: [FOLDER],
          systemPrompt: '',
          prompt: 'hello',
          intent: '',
          model: '',
          permissions: SCOPED,
          skills: [],
          images: [],
          options: {},
          ...scope,
        }),
      ),
    );
  return { seen, events, run };
}

const settle = (): Promise<void> => new Promise((done) => setImmediate(done));
const errors = (events: readonly RunnerEvent[]) => events.filter((event) => event.type === 'error');

describe('Dispatcher は指定フォルダの依頼を、範囲を守れると申告したアダプタにだけ渡す', () => {
  it('申告したアダプタには届く', async () => {
    const { seen, events, run } = setup();
    run('scoped', { writableDirs: [FOLDER] });
    await settle();
    expect(seen.map((request) => request.writableDirs)).toEqual([[FOLDER]]);
    expect(errors(events)).toEqual([]);
  });

  it('申告のないアダプタと、守れないと答えたアダプタには渡さない', async () => {
    const { seen, events, run } = setup();
    run('plain', { writableDirs: [FOLDER] });
    run('refusing', { writableDirs: [FOLDER] });
    await settle();
    expect(seen).toEqual([]);
    expect(errors(events)).toMatchObject([
      { id: 'job-plain', code: 'unsupported_permission', message: 'このバックエンドはフォルダ制限に未対応です' },
      { id: 'job-refusing', code: 'unsupported_permission', message: 'この PC では範囲を守れません' },
    ]);
  });

  it('指定フォルダでない依頼は、申告がなくても届く', async () => {
    const { seen, events, run } = setup();
    run('plain', {});
    run('refusing', {});
    await settle();
    expect(seen).toHaveLength(2);
    expect(errors(events)).toEqual([]);
  });
});

describe('内蔵のアダプタの申告', () => {
  const request = (backend: string, permissions: Permissions = SCOPED): RunRequest =>
    ({ backend, workspace: WORK, readableDirs: [FOLDER], writableDirs: [FOLDER], permissions }) as RunRequest;
  const scopeOf = (backend: string) => createBuiltinRegistry().find(backend)?.folderScope;

  it.each(['codex', 'grok', 'muse'])('%s は受ける（コマンドは隔離の中で動くので、使えるままでよい）', (backend) => {
    expect(() => scopeOf(backend)?.(request(backend, { ...SCOPED, runCommands: true }))).not.toThrow();
    expect(scopeOf(backend)).toBeTypeOf('function');
    expect(() => scopeOf(backend)?.(request(backend, { ...SCOPED, writeAnywhere: true }))).toThrow('両立');
  });

  it('ollama は受けるが、コマンドとは両立しない', () => {
    expect(() => scopeOf('ollama')?.(request('ollama'))).not.toThrow();
    expect(scopeOf('ollama')).toBeTypeOf('function');
    expect(() => scopeOf('ollama')?.(request('ollama', { ...SCOPED, runCommands: true }))).toThrow('両立');
  });

  it('claude は理由を付けて断る', () => {
    expect(() => scopeOf('claude')?.(request('claude'))).toThrow('リンク差し替え');
    expect(scopeOf('claude')).toBeTypeOf('function');
  });
});
