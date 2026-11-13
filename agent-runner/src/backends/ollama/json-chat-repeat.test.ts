import { mkdtemp, mkdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { parseAction, executeAction } from './actions.ts';
import { jsonChat } from './json-chat.ts';
import { localHttp } from './http.ts';
import { pretendMacOS, runContext, runRequest } from '../run.test-support.ts';

vi.mock('./http.ts', () => ({ localHttp: vi.fn() }));
vi.mock('./actions.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./actions.ts')>()),
  executeAction: vi.fn(() => Promise.resolve('read result')),
}));

const http = vi.mocked(localHttp);
const execute = vi.mocked(executeAction);
const model = { id: 'deepseek-r1:8b', capabilities: ['completion', 'thinking'] } as never;
const roots: string[] = [];

function reply(content: string): void {
  http.mockResolvedValueOnce({ status: 200, text: JSON.stringify({ message: { content } }) });
}

function read(path = 'same.txt'): string {
  return JSON.stringify({ action: 'read_file', path, text: '', content: '', command: '', name: '' });
}

function final(): string {
  return JSON.stringify({ action: 'final', text: '完了', path: '', content: '', command: '', name: '' });
}

async function setup(): Promise<{ stateDir: string }> {
  const root = await mkdtemp(join(tmpdir(), 'ollama-repeat-'));
  roots.push(root);
  const stateDir = join(root, 'state');
  await mkdir(stateDir);
  return { stateDir };
}

beforeEach(() => {
  http.mockReset();
  execute.mockClear();
});
afterEach(async () => {
  for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true });
});
pretendMacOS();

describe('Ollama JSON action compatibility and repeated reads', () => {
  it('新しい action 形式を従来の内部形式に変換する', () => {
    expect(parseAction('{"action":"read_file","path":"a.txt"}')).toMatchObject({ type: 'tool', tool: 'read_file' });
  });

  it('古い type と tool 形式も受け付ける', () => {
    expect(parseAction('{"type":"tool","tool":"read_file","path":"a.txt"}')).toMatchObject({
      type: 'tool',
      tool: 'read_file',
    });
  });

  it('成功済みの同じ read_file を再実行せず、失敗結果を記録する', async () => {
    const { stateDir } = await setup();
    reply(read());
    reply(read());
    reply(final());
    await jsonChat(
      { ...runRequest('ollama'), stateDir, options: { enableTools: true } },
      runContext(),
      model,
      'hello',
      [],
    );
    expect(execute).toHaveBeenCalledTimes(1);
    const rows = (await readFile(join(stateDir, 'ollama-actions.jsonl'), 'utf8')).trim().split('\n');
    expect(rows).toHaveLength(2);
    const duplicate = JSON.parse(rows[1]!) as { error?: string };
    expect(duplicate.error).toContain('1 回目で成功済み');
  });

  it('write_file 成功後は同じ read_file をもう一度実行する', async () => {
    const { stateDir } = await setup();
    reply(read());
    reply(JSON.stringify({ action: 'write_file', path: 'same.txt', text: '', content: 'new', command: '', name: '' }));
    reply(read());
    reply(final());
    await jsonChat(
      { ...runRequest('ollama'), stateDir, options: { enableTools: true } },
      runContext(),
      model,
      'hello',
      [],
    );
    expect(execute).toHaveBeenCalledTimes(3);
  });
});
