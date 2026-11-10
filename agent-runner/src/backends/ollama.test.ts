import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ollamaAdapter } from './ollama.ts';
import { localHttp } from './ollama/http.ts';
import { BackendRegistry } from './registry.ts';
import { runContext, runRequest } from './run.test-support.ts';

vi.mock('./ollama/http.ts', () => ({ localHttp: vi.fn() }));
const http = vi.mocked(localHttp);
const gemma = { model: 'gemma4:26b', capabilities: ['completion', 'vision'] };
const deepseek = { model: 'deepseek-r1:8b', capabilities: ['completion', 'thinking'] };
const imagePath = fileURLToPath(new URL('../../../src-tauri/icons/32x32.png', import.meta.url));
const images = [{ path: imagePath, mediaType: 'image/png' }];

function reply(body: object): void {
  http.mockResolvedValueOnce({ status: 200, text: JSON.stringify(body) });
}

beforeEach(() => http.mockReset());

describe('Ollama', () => {
  it('ローカルの会話モデルだけを選べる。能力が一覧にないときは詳細から取得する', async () => {
    reply({
      models: [
        { name: gemma.model },
        { ...deepseek, details: { parameter_size: '8.2B' } },
        { model: 'embedding:latest', capabilities: ['embedding'] },
        { model: 'remote:latest', capabilities: ['completion'], remote_model: 'llm' },
        { model: 'remote:latest', capabilities: ['completion'], remote_host: 'https://example.com' },
        { model: 'remote:671b-cloud', capabilities: ['completion'] },
      ],
    });
    reply({ capabilities: gemma.capabilities });
    const registry = new BackendRegistry([ollamaAdapter]);
    expect(await registry.describe()).toMatchObject([
      {
        id: 'ollama',
        status: 'ready',
        defaultModel: deepseek.model,
        models: [
          { id: deepseek.model, description: '8.2B · 文章に対応' },
          { id: gemma.model, description: '画像と文章に対応' },
        ],
        canLogin: false,
      },
    ]);
    expect(http.mock.calls.map(([path, , body]) => [path, body])).toEqual([
      ['/api/tags', undefined],
      ['/api/show', JSON.stringify({ model: `${gemma.model}:local` })],
    ]);
  });

  it('Ollama の起動やモデルの追加が必要なときは再確認を案内する', async () => {
    const registry = new BackendRegistry([ollamaAdapter]);
    http.mockRejectedValueOnce(new Error('connection refused'));
    const [stopped] = await registry.describe();
    expect(stopped).toMatchObject({ status: 'unavailable', models: [] });
    expect(stopped?.statusMessage).toContain('Ollama アプリを起動');
    reply({ models: [] });
    const [empty] = await registry.describe();
    expect(empty).toMatchObject({ status: 'unavailable', models: [] });
    expect(empty?.statusMessage).toContain('会話用のローカルモデルを追加');
  });

  it('選んだ画像対応モデルへローカル限定で会話と画像を渡す', async () => {
    reply({ models: [deepseek, gemma] });
    reply({ message: { content: '  返答  ', thinking: '考え中' } });
    const request = { ...runRequest('ollama'), model: gemma.model, images };
    await expect(ollamaAdapter.run(request, runContext())).resolves.toBe('返答');
    const [path, , body] = http.mock.calls[1] ?? [];
    expect(path).toBe('/api/chat');
    expect(JSON.parse(body ?? '{}')).toEqual({
      model: `${gemma.model}:local`,
      stream: false,
      messages: [
        { role: 'system', content: request.systemPrompt },
        { role: 'user', content: request.prompt, images: [(await readFile(imagePath)).toString('base64')] },
      ],
    });
  });

  it('文章用のモデルには画像を渡さず、返答に案内を添える', async () => {
    reply({ models: [deepseek] });
    reply({ message: { content: '返答' } });
    const request = { ...runRequest('ollama'), images };
    await expect(ollamaAdapter.run(request, runContext())).resolves.toContain('添付画像は読み取っていません');
    const body = http.mock.calls[1]?.[2] ?? '{}';
    expect(JSON.parse(body)).toMatchObject({
      model: `${deepseek.model}:local`,
      messages: [
        { role: 'system', content: request.systemPrompt },
        { role: 'user', content: expect.stringContaining('添付画像は入力されていません') as unknown },
      ],
    });
    expect(body).not.toContain('"images"');
  });

  it('選んだモデルが消えていたら別のモデルで実行しない', async () => {
    reply({ models: [deepseek] });
    await expect(
      ollamaAdapter.run({ ...runRequest('ollama'), model: gemma.model }, runContext()),
    ).rejects.toMatchObject({
      code: 'model_not_found',
    });
    expect(http).toHaveBeenCalledTimes(1);
  });
});
