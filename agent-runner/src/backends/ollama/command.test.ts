import { describe, expect, it, vi } from 'vitest';
import { runLocalCommand } from './command.ts';
import { executeTool, sandbox } from './tools.ts';
import { runRequest } from '../run.test-support.ts';
vi.mock('./tools.ts', () => ({
  sandbox: vi.fn(() => Promise.resolve({ profile: 'restricted', workspace: '/work' })),
  executeTool: vi.fn(),
}));

describe('shared command executor', () => {
  it('Seatbelt内の実行結果の終了コードと本文をJSON操作へ返す', async () => {
    vi.mocked(executeTool).mockResolvedValueOnce('exit=3\nmessage');
    const request = runRequest('ollama');
    expect(JSON.parse(await runLocalCommand(request, 'echo ok', new AbortController().signal))).toEqual({
      exitCode: 3,
      output: 'message',
      stopped: false,
    });
  });
  it('隔離の準備に失敗したら実行せず終了する', async () => {
    vi.mocked(executeTool).mockClear();
    vi.mocked(sandbox).mockRejectedValueOnce(new Error('sandbox failed'));
    await expect(runLocalCommand(runRequest('ollama'), 'bad', new AbortController().signal)).rejects.toThrow(
      'sandbox failed',
    );
    expect(executeTool).not.toHaveBeenCalled();
  });
});
