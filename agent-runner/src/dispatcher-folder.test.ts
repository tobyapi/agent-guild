// 指定フォルダのチャンネルの依頼（writableDirs つき）は、範囲の守り方を申告した（info().folderScope）アダプタだけに届く。
// 内蔵のアダプタでは、Ollama がファイルの道具ごと、Codex 系（Codex・Grok・Muse）が隔離で守ると申告し、Claude は申告しない。
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createBuiltinRegistry, BackendRegistry } from './backends/registry.ts';
import { NO_SETUP, type BackendAdapter, type RunRequest } from './backends/types.ts';
import { Dispatcher } from './dispatcher.ts';
import { parseLine } from './line-parser.ts';
import type { FolderScope, Permissions, RunnerEvent } from './protocol.ts';

const WORK = resolve('/data/agents/a1/channels/c1/work');
const FOLDER = resolve('/projects/site');

/** 指定フォルダで Rust が渡す権限（PC 全体の読み書きとスキルは外してある。コマンドは隔離で守るバックエンドでだけ残る） */
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

const adapter = (id: string, seen: RunRequest[], folderScope: FolderScope | null): BackendAdapter => ({
  info: () => ({
    id,
    label: id,
    capabilities: { ...SCOPED, runCommands: true },
    options: [],
    permissionRules: [],
    leakRisks: [],
    unrestricted: [],
    midRunPost: null,
    folderScope,
    toolsOption: null,
    local: false,
    frameGeneration: false,
    setup: NO_SETUP,
  }),
  probe: () => Promise.resolve({ status: 'ready', statusMessage: '' }),
  run(request) {
    seen.push(request);
    return Promise.resolve('ok');
  },
});

function setup() {
  const seen: RunRequest[] = [];
  const events: RunnerEvent[] = [];
  const dispatcher = new Dispatcher({
    registry: new BackendRegistry([
      adapter('sandboxed', seen, 'sandbox'),
      adapter('files', seen, 'files'),
      adapter('plain', seen, null),
    ]),
    runnerVersion: '9.9.9',
    send: (event) => events.push(event),
    exit: () => {},
  });
  const run = (backend: string, scope: object, permissions: Permissions = SCOPED): void =>
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
          permissions,
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

describe('Dispatcher は指定フォルダの依頼を、範囲の守り方を申告したアダプタにだけ渡す', () => {
  it('申告したアダプタには届く', async () => {
    const { seen, events, run } = setup();
    run('sandboxed', { writableDirs: [FOLDER] }, { ...SCOPED, runCommands: true });
    run('files', { writableDirs: [FOLDER] });
    await settle();
    expect(seen.map((request) => [request.backend, request.writableDirs])).toEqual([
      ['sandboxed', [FOLDER]],
      ['files', [FOLDER]],
    ]);
    expect(errors(events)).toEqual([]);
  });

  it('申告のないアダプタと、その守り方では両立しない権限の依頼は渡さない', async () => {
    const { seen, events, run } = setup();
    run('plain', { writableDirs: [FOLDER] });
    run('files', { writableDirs: [FOLDER] }, { ...SCOPED, runCommands: true });
    await settle();
    expect(seen).toEqual([]);
    expect(errors(events)).toMatchObject([
      {
        id: 'job-plain',
        code: 'unsupported_permission',
        message: 'plain は範囲を守れないため、指定フォルダのチャンネルでは実行できません',
      },
      { id: 'job-files', code: 'unsupported_permission', message: 'フォルダ制限と両立しない権限です' },
    ]);
  });

  it('指定フォルダでない依頼は、申告がなくても届く', async () => {
    const { seen, events, run } = setup();
    run('plain', {});
    await settle();
    expect(seen).toHaveLength(1);
    expect(errors(events)).toEqual([]);
  });
});

describe('内蔵のアダプタの申告', () => {
  const scopeOf = (backend: string) => createBuiltinRegistry().find(backend)?.info().folderScope;

  it('Codex 系は隔離、Ollama はファイルの道具ごとに守り、Claude は指定フォルダでは実行しない', () => {
    expect(['codex', 'grok', 'muse'].map(scopeOf)).toEqual(['sandbox', 'sandbox', 'sandbox']);
    expect(scopeOf('ollama')).toBe('files');
    expect(scopeOf('claude')).toBeNull();
  });
});
