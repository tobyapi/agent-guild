import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ollamaAdapter } from '../ollama.ts';
import { localHttp } from './http.ts';
import { executeTool } from './tools.ts';
import { runLocalCommand } from './command.ts';
import { pretendMacOS, runContext, runRequest } from '../run.test-support.ts';
vi.mock('./http.ts', () => ({ localHttp: vi.fn() }));
vi.mock('./command.ts', () => ({ runLocalCommand: vi.fn() }));
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
  it('native JSON要求の拒否も投稿し、結果をモデルに返して実行を続ける', async () => {
    start();
    reply({ message: { content: action('run_command', { command: 'echo hello' }) } });
    reply({ message: { content: 'DENY: 依頼の範囲外です' } });
    reply({ message: { content: '完了' } });
    const req = { ...request(), intent: 'ファイルを読むだけにしてください。' };
    req.options.operationCheck = true;
    const context = runContext();
    await expect(ollamaAdapter.run(req, context)).resolves.toBe('完了');
    expect(context.onPost).toHaveBeenCalledExactlyOnceWith(expect.stringContaining('依頼の範囲外です'));
    expect(http.mock.calls[4]?.[2]).toContain('依頼の範囲外です');
    expect(runLocalCommand).not.toHaveBeenCalled();
  });
});

it('ネイティブ呼び出しは拒否を投稿し、次の道具で続行する', async () => {
  start();
  const call = (name: string, args: object) => ({ message: { tool_calls: [{ function: { name, arguments: args } }] } });
  reply(call('run_command', { command: 'echo hello' }));
  reply({ message: { content: 'DENY: 依頼の範囲外です' } });
  reply(call('read_file', { path: 'hello' }));
  reply({ message: { content: '完了' } });
  const req = { ...request(), intent: 'ファイルを読むだけにしてください。' };
  req.options.operationCheck = true;
  const context = { ...runContext(), askApproval: vi.fn(() => Promise.resolve('denied' as const)) };
  await expect(ollamaAdapter.run(req, context)).resolves.toBe('完了');
  expect(context.askApproval).toHaveBeenCalledWith(expect.objectContaining({ detail: 'echo hello' }));
  expect(context.onPost).toHaveBeenCalledExactlyOnceWith(expect.stringContaining('依頼の範囲外です'));
  const body: unknown = JSON.parse(http.mock.calls[4]?.[2] ?? '{}');
  expect(body).toMatchObject({
    messages: expect.arrayContaining([
      { role: 'tool', tool_name: 'run_command', content: expect.stringContaining('依頼の範囲外です') as unknown },
    ]) as unknown,
  });
  expect(executeTool).toHaveBeenCalledTimes(1);
  expect(vi.mocked(executeTool).mock.calls[0]?.[1]).toBe('read_file');
});

it('ネイティブ呼び出しは承認されるまで待機し、同じコマンドだけを一度実行する', async () => {
  start();
  const command = 'printf "%s\\n" "one"\nprintf "%s\\n" "two"';
  reply({ message: { tool_calls: [{ function: { name: 'run_command', arguments: { command } } }] } });
  reply({ message: { content: '**DENY:** 操作の目的が不明です' } });
  reply({ message: { content: '完了' } });
  const req = { ...request(), intent: '確認してください' };
  req.options.operationCheck = true;
  let approve!: (value: 'approved') => void;
  const approval = new Promise<'approved'>((resolve) => {
    approve = resolve;
  });
  const context = { ...runContext(), askApproval: vi.fn(() => approval) };
  const run = ollamaAdapter.run(req, context);
  await vi.waitFor(() => {
    expect(context.askApproval).toHaveBeenCalledExactlyOnceWith({
      operation: 'run_command',
      workspace: req.workspace,
      detail: command,
      reason: '操作の目的が不明です',
    });
  });
  expect(executeTool).not.toHaveBeenCalled();
  approve('approved');
  await expect(run).resolves.toBe('完了');
  expect(executeTool).toHaveBeenCalledExactlyOnceWith(
    expect.anything(),
    'run_command',
    { command },
    expect.anything(),
    expect.anything(),
    context,
  );
  expect(context.onPost).not.toHaveBeenCalled();
});
