// アダプタの run のテストで使う、依頼（RunRequest）と実行の文脈（RunContext）の組み立て。
import { afterAll, beforeAll, vi } from 'vitest';
import type { RunContext, RunRequest } from './types.ts';

/** 本物の macOS で動いているか（Seatbelt を実際に動かすテストはこれで絞る。pretendMacOS で変わる前の値） */
export const REAL_MACOS = process.platform === 'darwin';

/**
 * そのファイルのテストの間、OS を macOS と申告する。Ollama の道具は macOS だけで有効になるので、
 * HTTP と OS の実行をモックしたテストを、ほかの OS（CI は Windows）でも同じ分岐で動かすために使う。
 */
export function pretendMacOS(): void {
  const original = process.platform;
  beforeAll(() => {
    Object.defineProperty(process, 'platform', { value: 'darwin' });
  });
  afterAll(() => {
    Object.defineProperty(process, 'platform', { value: original });
  });
}

/** バックエンド backend への依頼。権限は読み書きとコマンドだけ（Web と作業場所の外への書き込みはなし） */
export const runRequest = (backend: string): RunRequest => ({
  type: 'run',
  id: 'j',
  backend,
  workspace: '/work',
  stateDir: '/state',
  readableDirs: [],
  model: '',
  prompt: 'hello',
  systemPrompt: 'system',
  intent: '',
  options: {},
  skills: [],
  images: [],
  permissions: {
    webSearch: false,
    webFetch: false,
    readFiles: true,
    readAnywhere: false,
    writeFiles: true,
    writeAnywhere: false,
    runCommands: true,
    skills: true,
  },
});

export const runContext = (signal = new AbortController().signal): RunContext => ({
  signal,
  onActivity: vi.fn(),
  onPost: vi.fn(),
  onUsage: vi.fn(),
});
