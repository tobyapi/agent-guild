import { beforeEach, describe, expect, it, vi } from 'vitest';
import { checkOperation } from './chat.ts';
import { localHttp } from './http.ts';
import { runRequest } from '../run.test-support.ts';
import { BackendError } from '../types.ts';

vi.mock('./http.ts', () => ({ localHttp: vi.fn() }));
const http = vi.mocked(localHttp);
const model = { id: 'tools:1b', size: '', capabilities: ['completion'] };
const signal = new AbortController().signal;

beforeEach(() => http.mockReset());

async function check(answer: string, command = 'echo hello') {
  http.mockResolvedValueOnce({ status: 200, text: JSON.stringify({ message: { content: answer } }) });
  const request = runRequest('ollama');
  request.options.enableTools = true;
  request.options.operationCheck = true;
  request.permissions.writeAnywhere = true;
  await checkOperation(request, model, 'write_file', { path: '/tmp/out', content: command }, signal);
}

describe('Ollama operation check rejection details', () => {
  async function expectRecordedRejection(answer: string) {
    try {
      await check(answer);
      throw new Error('Expected operation check to reject');
    } catch (error) {
      expect(error).toBeInstanceOf(BackendError);
      if (!(error instanceof BackendError)) throw error;
      expect(error.code).toBe('unsupported_permission');
      expect(error.message).toContain('write_file');
      expect(error.message).toContain('"path":"/tmp/out","content":"echo hello"');
      expect(error.message).toContain(answer ? `確認の応答: ${answer}` : '確認の応答: ）');
    }
  }

  it('DENY の答えを記録する', () => expectRecordedRejection('DENY'));
  it('余分な言葉がある答えを記録する', () => expectRecordedRejection('ALLOW です'));
  it('空の答えを記録する', () => expectRecordedRejection(''));

  it('長い引数を200文字で切り詰めて省略記号を付ける', async () => {
    const command = `head${'x'.repeat(250)}`;
    const expectedHead = JSON.stringify({ path: '/tmp/out', content: command }).slice(0, 200);
    try {
      await check('DENY', command);
      throw new Error('Expected operation check to reject');
    } catch (error) {
      expect(error).toBeInstanceOf(BackendError);
      if (!(error instanceof BackendError)) throw error;
      expect(error.code).toBe('unsupported_permission');
      expect(error.message).toContain(`${expectedHead}…`);
    }
  });

  it('ALLOW なら拒否しない', async () => {
    await expect(check('ALLOW')).resolves.toBeUndefined();
  });
});
