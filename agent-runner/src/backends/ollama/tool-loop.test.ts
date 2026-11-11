import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ollamaAdapter } from '../ollama.ts';
import { localHttp } from './http.ts';
import { sandbox, executeTool } from './tools.ts';
import { pretendMacOS, runContext, runRequest } from '../run.test-support.ts';
vi.mock('./http.ts', () => ({ localHttp: vi.fn() }));
vi.mock('./tools.ts', async (original) => ({
  ...(await original<typeof import('./tools.ts')>()),
  sandbox: vi.fn(() => Promise.resolve({ profile: 'mock', workspace: '/work' })),
  executeTool: vi.fn(() => Promise.resolve('tool result')),
}));
const http = vi.mocked(localHttp);
const deepseek = { model: 'deepseek-r1:8b', capabilities: ['completion', 'thinking'] };
function reply(body: object): void {
  http.mockResolvedValueOnce({ status: 200, text: JSON.stringify(body) });
}
beforeEach(() => http.mockReset());
pretendMacOS();
describe('Ollama tool loop', () => {
  const toolModel = { model: 'small:1b', capabilities: ['completion', 'tools'] };
  function start() {
    reply({ models: [toolModel] });
    reply({ capabilities: toolModel.capabilities });
  }
  it('明示的に有効化しない既存エージェントには道具を渡さない', async () => {
    start();
    reply({ message: { content: '会話' } });
    await expect(ollamaAdapter.run(runRequest('ollama'), runContext())).resolves.toBe('会話');
    expect(JSON.parse(http.mock.calls[2]?.[2] ?? '{}')).not.toHaveProperty('tools');
  });
  it('ネイティブ非対応モデルは有効化後もnative toolsを渡さずJSON操作を使う', async () => {
    reply({ models: [deepseek] });
    reply({ message: { content: '会話' } });
    await ollamaAdapter.run({ ...runRequest('ollama'), options: { enableTools: true } }, runContext());
    expect(JSON.parse(http.mock.calls[1]?.[2] ?? '{}')).not.toHaveProperty('tools');
  });
  it('有効化していないのに道具を要求したら実行しない', async () => {
    start();
    reply({ message: { tool_calls: [{ function: { name: 'run_command', arguments: { command: 'bad' } } }] } });
    await expect(ollamaAdapter.run(runRequest('ollama'), runContext())).rejects.toMatchObject({
      code: 'unsupported_permission',
    });
  });
});

describe('Ollama enabled tools (HTTP と OS 実行をモック)', () => {
  const model = { model: 'tools:1b', capabilities: ['completion', 'tools'] };
  const call = (name = 'read_file') => ({
    message: { content: '', tool_calls: [{ function: { name, arguments: { path: 'hello' } } }] },
  });
  const request = () => ({ ...runRequest('ollama'), options: { enableTools: true, operationCheck: false } });
  function start() {
    reply({ models: [model] });
    reply({ capabilities: model.capabilities });
    vi.mocked(executeTool).mockClear();
  }
  it('呼び出し→実行→結果を返す→最終回答', async () => {
    start();
    reply(call());
    reply({ message: { content: '完了' } });
    await expect(ollamaAdapter.run(request(), runContext())).resolves.toBe('完了');
    expect(sandbox).toHaveBeenCalled();
    expect(executeTool).toHaveBeenCalledTimes(1);
    expect(JSON.parse(http.mock.calls[3]?.[2] ?? '{}')).toMatchObject({
      messages: expect.arrayContaining([{ role: 'tool', tool_name: 'read_file', content: 'tool result' }]) as unknown,
    });
  });
  it('権限のない道具を実行しない', async () => {
    start();
    reply(call('write_file'));
    const req = request();
    req.permissions.writeFiles = false;
    await expect(ollamaAdapter.run(req, runContext())).rejects.toMatchObject({ code: 'unsupported_permission' });
    expect(executeTool).not.toHaveBeenCalled();
  });
  it('16ターンで停止する', async () => {
    start();
    for (let i = 0; i < 16; i++) reply(call());
    await expect(ollamaAdapter.run(request(), runContext())).rejects.toThrow('16ターン');
    expect(executeTool).toHaveBeenCalledTimes(16);
  });
  it('1回に64件を超える道具を拒否する', async () => {
    start();
    reply({ message: { tool_calls: Array.from({ length: 65 }, () => call().message.tool_calls[0]) } });
    await expect(ollamaAdapter.run(request(), runContext())).rejects.toThrow('上限');
    expect(executeTool).not.toHaveBeenCalled();
  });
  it('中断済みなら HTTP にも接続しない', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(ollamaAdapter.run(request(), runContext(controller.signal))).rejects.toThrow();
    expect(http).not.toHaveBeenCalled();
  });
  it('操作確認の拒否ではコマンドを動かさない', async () => {
    start();
    reply(call('run_command'));
    reply({ message: { content: 'DENY' } });
    const req = request();
    req.options.operationCheck = true;
    await expect(ollamaAdapter.run(req, runContext())).rejects.toThrow('確認');
    expect(executeTool).not.toHaveBeenCalled();
  });
});

it('showで非対応ならnative toolsを渡さずJSON操作へ進む', async () => {
  reply({ models: [{ model: 'bad:1b', capabilities: ['completion', 'tools', 'tools'] }] });
  reply({ capabilities: ['completion'] });
  reply({ message: { content: '会話' } });
  await ollamaAdapter.run({ ...runRequest('ollama'), options: { enableTools: true } }, runContext());
  expect(JSON.parse(http.mock.calls[2]?.[2] ?? '{}')).not.toHaveProperty('tools');
});
