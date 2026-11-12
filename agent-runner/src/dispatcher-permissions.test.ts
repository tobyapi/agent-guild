// run の権限は役割で決まり、どのバックエンドにも同じものが届く。Dispatcher は、その中でバックエンドが守って使える操作だけを
// アダプタに渡す（アダプタは申告した以上の操作を受け取らない）。
import { describe, expect, it } from 'vitest';
import { BackendRegistry } from './backends/registry.ts';
import { PLAIN } from './backends/descriptor.test-support.ts';
import type { BackendAdapter, BackendDescriptor, RunRequest } from './backends/types.ts';
import { Dispatcher } from './dispatcher.ts';
import { parseLine } from './line-parser.ts';
import type { Permissions, RunnerEvent } from './protocol.ts';

/** 専門家の権限（作業フォルダ内の読み書きとコマンド・スキル、外も読む。Web と外への書き込みはなし） */
const EXPERT: Permissions = {
  webSearch: false,
  webFetch: false,
  readFiles: true,
  readAnywhere: true,
  writeFiles: true,
  writeAnywhere: false,
  runCommands: true,
  skills: true,
};
const ALL: Permissions = { ...EXPERT, webSearch: true, webFetch: true, writeAnywhere: true };

/** コマンドを隔離できない（外への書き込みと Web も許す役割でだけ使える）バックエンドと、道具が少ないバックエンド */
const DESCRIPTORS: readonly BackendDescriptor[] = [
  {
    id: 'unsandboxed',
    label: 'Unsandboxed',
    capabilities: ALL,
    options: [],
    permissionRules: [{ when: 'runCommands', requires: ['writeAnywhere', 'webFetch'] }],
    leakRisks: [],
    unrestricted: [],
    midRunPost: null,
    ...PLAIN,
  },
  {
    id: 'sandboxed',
    label: 'Sandboxed',
    capabilities: { ...ALL, readAnywhere: false, skills: false },
    options: [],
    permissionRules: [],
    leakRisks: [],
    unrestricted: [],
    midRunPost: null,
    ...PLAIN,
  },
];

function setup() {
  const seen = new Map<string, RunRequest>();
  const adapters = DESCRIPTORS.map((descriptor): BackendAdapter => ({
    info: () => descriptor,
    probe: () => Promise.resolve({ status: 'ready', statusMessage: '' }),
    run(request) {
      seen.set(descriptor.id, request);
      return Promise.resolve('ok');
    },
  }));
  const events: RunnerEvent[] = [];
  const dispatcher = new Dispatcher({
    registry: new BackendRegistry(adapters),
    runnerVersion: '9.9.9',
    send: (event) => events.push(event),
    exit: () => {},
  });
  const run = (backend: string, permissions: Permissions): void =>
    dispatcher.receive(
      parseLine(
        JSON.stringify({
          type: 'run',
          id: `job-${backend}`,
          backend,
          workspace: '/ws',
          stateDir: '/state',
          readableDirs: [],
          systemPrompt: '',
          prompt: 'hello',
          intent: '',
          model: '',
          permissions,
          skills: [],
          images: [],
          options: {},
        }),
      ),
    );
  return { seen, events, run };
}

const settle = (): Promise<void> => new Promise((resolve) => setImmediate(resolve));

describe('Dispatcher は役割の権限を、バックエンドが守れる操作に絞ってから渡す', () => {
  it('同じ権限を渡しても、アダプタが受け取るのは自分が守れる操作だけ（拒否はしない）', async () => {
    const { seen, events, run } = setup();
    run('unsandboxed', EXPERT);
    run('sandboxed', EXPERT);
    await settle();
    expect(seen.get('unsandboxed')?.permissions).toEqual({ ...EXPERT, runCommands: false });
    expect(seen.get('sandboxed')?.permissions).toEqual({ ...EXPERT, readAnywhere: false, skills: false });
    expect(events.filter((event) => event.type === 'error')).toEqual([]);
    expect(events.filter((event) => event.type === 'result')).toHaveLength(2);
  });

  it('渡されていない操作は、バックエンドが持っていても足さない', async () => {
    const readOnly: Permissions = { ...EXPERT, writeFiles: false, runCommands: false, skills: false };
    for (const granted of [readOnly, ALL]) {
      const { seen, run } = setup();
      run('unsandboxed', granted);
      await settle();
      expect(seen.get('unsandboxed')?.permissions).toEqual(granted);
    }
  });
});
