import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ollamaAdapter } from '../ollama.ts';
import { localHttp } from './http.ts';
import { sandbox, executeTool } from './tools.ts';
import { runLocalCommand } from './command.ts';
import { NUM_PREDICT } from './limits.ts';
import { pretendMacOS, runContext, runRequest } from '../run.test-support.ts';
vi.mock('./http.ts', () => ({ localHttp: vi.fn() }));
vi.mock('./command.ts', () => ({ runLocalCommand: vi.fn() }));
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
  it('エージェントの設定には道具に関する2項目を出す', () => {
    expect(ollamaAdapter.info().options.map((option) => option.key)).toEqual(['enableTools', 'operationCheck']);
  });
  it('明示的に有効化しない既存エージェントには道具を渡さない', async () => {
    reply({ models: [{ model: 'thinking-chat:1b', capabilities: ['completion', 'thinking'] }] });
    reply({ message: { content: '会話' } });
    await expect(ollamaAdapter.run(runRequest('ollama'), runContext())).resolves.toBe('会話');
    const body = JSON.parse(http.mock.calls[1]?.[2] ?? '{}') as Record<string, unknown>;
    expect(body).not.toHaveProperty('tools');
    expect(body).not.toHaveProperty('think');
  });
  it('ネイティブ非対応モデルは有効化後もnative toolsを渡さずJSON操作を使う', async () => {
    reply({ models: [deepseek] });
    reply({ message: { content: '会話' } });
    await ollamaAdapter.run({ ...runRequest('ollama'), options: { enableTools: true } }, runContext());
    expect(JSON.parse(http.mock.calls[1]?.[2] ?? '{}')).not.toHaveProperty('tools');
  });
  it('thinking と native tools の両方に対応していてもJSON操作を使う', async () => {
    const thinkingTools = { model: 'thinking-tools:1b', capabilities: ['completion', 'tools', 'thinking'] };
    reply({ models: [thinkingTools] });
    reply({ capabilities: thinkingTools.capabilities });
    reply({ message: { content: '会話' } });
    await ollamaAdapter.run({ ...runRequest('ollama'), options: { enableTools: true } }, runContext());
    expect(JSON.parse(http.mock.calls[2]?.[2] ?? '{}')).not.toHaveProperty('tools');
    expect(JSON.parse(http.mock.calls[2]?.[2] ?? '{}')).toHaveProperty('think', false);
    expect(JSON.parse(http.mock.calls[2]?.[2] ?? '{}')).toMatchObject({ options: { num_predict: NUM_PREDICT } });
    const body = JSON.parse(http.mock.calls[2]?.[2] ?? '{}') as { options?: Record<string, unknown> };
    expect(body.options).not.toHaveProperty('temperature');
  });
  it('JSON経路は非thinkingモデルで temperature 0 と出力上限を送る', async () => {
    const plain = { model: 'plain:1b', capabilities: ['completion'] };
    reply({ models: [plain] });
    reply({ message: { content: '会話' } });
    await ollamaAdapter.run({ ...runRequest('ollama'), options: { enableTools: true } }, runContext());
    expect(JSON.parse(http.mock.calls[1]?.[2] ?? '{}')).toMatchObject({
      options: { num_predict: NUM_PREDICT, temperature: 0 },
    });
  });
  it('JSON経路で done_reason length は操作を解析せず、出力断片とeval_countを含むエラーにする', async () => {
    vi.mocked(executeTool).mockClear();
    reply({ models: [deepseek] });
    const head = 'H'.repeat(500);
    const tail = 'T'.repeat(500);
    reply({ message: { content: `${head}${'x'.repeat(20)}${tail}` }, done_reason: 'length', eval_count: NUM_PREDICT });
    await expect(
      ollamaAdapter.run({ ...runRequest('ollama'), options: { enableTools: true } }, runContext()),
    ).rejects.toThrow(new RegExp(`${NUM_PREDICT}.*${head.slice(0, 20)}.*${tail.slice(-20)}`));
    expect(executeTool).not.toHaveBeenCalled();
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
    message: {
      content: '',
      tool_calls: [
        {
          function: { name, arguments: name === 'run_command' ? { command: 'echo hello' } : { path: 'hello' } },
        },
      ],
    },
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
      options: { num_predict: NUM_PREDICT },
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
  it('ネイティブ経路で done_reason length は道具を実行せず、出力断片とeval_countを含むエラーにする', async () => {
    start();
    const head = 'H'.repeat(500);
    const tail = 'T'.repeat(500);
    reply({
      message: { content: `${head}${'x'.repeat(20)}${tail}`, tool_calls: [call().message.tool_calls[0]] },
      done_reason: 'length',
      eval_count: NUM_PREDICT,
    });
    await expect(ollamaAdapter.run(request(), runContext())).rejects.toThrow(
      new RegExp(`${NUM_PREDICT}.*${head.slice(0, 20)}.*${tail.slice(-20)}`),
    );
    expect(executeTool).not.toHaveBeenCalled();
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
  it('JSON 操作は拒否を投稿し、コマンドを実行せず最終回答まで進む', async () => {
    const thinkingModel = { model: 'tools:1b', capabilities: ['completion', 'tools', 'thinking'] };
    reply({ models: [thinkingModel] });
    reply({ capabilities: thinkingModel.capabilities });
    reply({
      message: {
        content: JSON.stringify({
          type: 'tool',
          tool: 'run_command',
          text: '',
          path: '',
          content: '',
          command: 'echo hello',
          name: '',
        }),
      },
    });
    reply({ message: { content: 'DENY: 依頼の範囲外です' } });
    reply({ message: { content: '回答' } });
    const req = request();
    req.options.operationCheck = true;
    req.intent = 'ファイルを読むだけにしてください。';
    const context = { ...runContext(), askApproval: vi.fn(() => Promise.resolve('timedOut' as const)) };
    await expect(ollamaAdapter.run(req, context)).resolves.toBe('回答');
    expect(runLocalCommand).not.toHaveBeenCalled();
    expect(context.onPost).toHaveBeenCalledExactlyOnceWith(expect.stringContaining('依頼の範囲外です'));
    expect(JSON.parse(http.mock.calls[3]?.[2] ?? '{}')).toHaveProperty('think', false);
    expect(http.mock.calls[4]?.[2]).toContain('承認待ちが時間切れになりました');
  });
});

it('showで非対応ならnative toolsを渡さずJSON操作へ進む', async () => {
  reply({ models: [{ model: 'bad:1b', capabilities: ['completion', 'tools', 'tools'] }] });
  reply({ capabilities: ['completion'] });
  reply({ message: { content: '会話' } });
  await ollamaAdapter.run({ ...runRequest('ollama'), options: { enableTools: true } }, runContext());
  expect(JSON.parse(http.mock.calls[2]?.[2] ?? '{}')).not.toHaveProperty('tools');
});
