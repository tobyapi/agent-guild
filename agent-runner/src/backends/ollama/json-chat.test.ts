import { beforeEach, describe, expect, it, vi } from 'vitest';
import { jsonChat } from './json-chat.ts';
import { localHttp } from './http.ts';
import { pretendMacOS, runContext, runRequest } from '../run.test-support.ts';

vi.mock('./http.ts', () => ({ localHttp: vi.fn() }));
const http = vi.mocked(localHttp);
const deepseek = { model: 'deepseek-r1:8b', capabilities: ['completion', 'thinking'] };

function reply(content: string): void {
  http.mockResolvedValueOnce({ status: 200, text: JSON.stringify({ message: { content } }) });
}

beforeEach(() => http.mockReset());
pretendMacOS();

describe('Ollama JSON chat action history', () => {
  it('長い共通パスでも末尾のファイル名を操作履歴で見分けられる', async () => {
    const prefix = `folder/${'shared-directory/'.repeat(8)}`;
    for (const filename of ['alpha-report.txt', 'beta-report.txt']) {
      reply(
        JSON.stringify({
          type: 'tool',
          tool: 'read_file',
          path: `${prefix}${filename}`,
          content: '',
          command: '',
          name: '',
          text: '',
        }),
      );
    }
    reply('{"type":"final","tool":"","path":"","content":"","command":"","name":"","text":""}');
    let failure: unknown;
    try {
      await jsonChat(
        { ...runRequest('ollama'), options: { enableTools: true } },
        runContext(),
        { id: deepseek.model, capabilities: deepseek.capabilities } as never,
        'hello',
        [],
      );
    } catch (error) {
      failure = error;
    }
    expect(String(failure)).toContain('alpha-report.txt');
    expect(String(failure)).toContain('beta-report.txt');
  });
});
