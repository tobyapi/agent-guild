import { mkdtemp, mkdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { jsonChat } from './json-chat.ts';
import { localHttp } from './http.ts';
import { pretendMacOS, runContext, runRequest } from '../run.test-support.ts';

vi.mock('./http.ts', () => ({ localHttp: vi.fn() }));
vi.mock('./actions.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./actions.ts')>()),
  executeAction: vi.fn(() => Promise.resolve('written')),
}));
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

import { afterEach } from 'vitest';
const tempDirs: string[] = [];
afterEach(async () => {
  for (const dir of tempDirs.splice(0)) await rm(dir, { recursive: true, force: true });
});

it('成功した write_file を JSONL に記録し content の文字数を残す', async () => {
  const root = await mkdtemp(join(tmpdir(), 'ollama-json-chat-'));
  tempDirs.push(root);
  const workspace = join(root, 'work');
  const stateDir = join(root, 'state');
  await mkdir(workspace);
  await mkdir(stateDir);
  const request = {
    ...runRequest('ollama'),
    workspace,
    stateDir,
    options: { enableTools: true, operationCheck: false },
  };
  reply(
    JSON.stringify({
      type: 'tool',
      tool: 'write_file',
      path: 'out.txt',
      content: '本文abc',
      command: '',
      name: '',
      text: '',
    }),
  );
  reply(JSON.stringify({ type: 'final', tool: '', path: '', content: '', command: '', name: '', text: '完了' }));
  expect(
    await jsonChat(
      request,
      runContext(),
      { id: deepseek.model, capabilities: deepseek.capabilities } as never,
      'save',
      [],
    ),
  ).toBe('完了');
  const lines = (await readFile(join(stateDir, 'ollama-actions.jsonl'), 'utf8')).trim().split('\n');
  expect(lines).toHaveLength(1);
  expect(JSON.parse(lines[0]!)).toMatchObject({
    tool: 'write_file',
    target: 'out.txt',
    contentLength: 5,
    success: true,
  });
});
