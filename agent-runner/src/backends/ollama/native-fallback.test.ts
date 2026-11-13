import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ollamaAdapter } from '../ollama.ts';
import { localHttp } from './http.ts';
import { executeTool } from './tools.ts';
import { pretendMacOS, runContext, runRequest } from '../run.test-support.ts';
vi.mock('./http.ts', () => ({ localHttp: vi.fn() }));
vi.mock('./tools.ts', async (original) => ({
  ...(await original<typeof import('./tools.ts')>()),
  sandbox: vi.fn(() => Promise.resolve({ profile: 'mock', workspace: '/work' })),
  executeTool: vi.fn(() => Promise.resolve('tool result')),
}));
const http = vi.mocked(localHttp);
const model = { model: 'tools:1b', capabilities: ['completion', 'tools'] };
const action = (tool: string, fields: Record<string, string> = {}) =>
  JSON.stringify({ type: 'tool', tool, text: '', path: '', content: '', command: '', name: '', ...fields });
function reply(body: object): void {
  http.mockResolvedValueOnce({ status: 200, text: JSON.stringify(body) });
}
function start() {
  reply({ models: [model] });
  reply({ capabilities: model.capabilities });
  vi.mocked(executeTool).mockClear();
}
const request = () => ({ ...runRequest('ollama'), options: { enableTools: true, operationCheck: false } });
beforeEach(() => http.mockReset());
pretendMacOS();

describe('Ollama native JSON fallback', () => {
  it('native tool_calls がない有効なJSON要求を実行して続行する', async () => {
    start();
    reply({ message: { content: action('post', { text: '報告' }) } });
    reply({ message: { content: '完了' } });
    await expect(ollamaAdapter.run(request(), runContext())).resolves.toBe('完了');
    expect(executeTool).toHaveBeenCalledWith(
      expect.anything(),
      'post',
      { text: '報告' },
      expect.anything(),
      expect.anything(),
      expect.anything(),
    );
  });
  it('native形式で実在しないJSON道具名は本文として返す', async () => {
    start();
    const content = action('missing_tool', { text: 'そのまま' });
    reply({ message: { content } });
    await expect(ollamaAdapter.run(request(), runContext())).resolves.toBe(content);
    expect(executeTool).not.toHaveBeenCalled();
  });
  it('道具がオフならJSON風の本文を実行せず返す', async () => {
    start();
    const content = action('post', { text: '報告' });
    reply({ message: { content } });
    await expect(ollamaAdapter.run(runRequest('ollama'), runContext())).resolves.toBe(content);
    expect(executeTool).not.toHaveBeenCalled();
  });
  it('native JSON要求でも判定役がDENYしたら実行しない', async () => {
    start();
    reply({ message: { content: action('run_command', { command: 'echo hello' }) } });
    reply({ message: { content: 'DENY' } });
    const req = request();
    req.options.operationCheck = true;
    await expect(ollamaAdapter.run(req, runContext())).rejects.toThrow('確認');
    expect(executeTool).not.toHaveBeenCalled();
  });
});
