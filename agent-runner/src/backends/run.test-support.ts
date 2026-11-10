// アダプタの run のテストで使う、依頼（RunRequest）と実行の文脈（RunContext）の組み立て。
import { vi } from 'vitest';
import type { RunContext, RunRequest } from './types.ts';

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
