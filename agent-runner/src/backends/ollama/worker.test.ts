import { mkdtemp, mkdir, readFile, realpath, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ollamaAdapter } from '../ollama.ts';
import { pretendMacOS, REAL_MACOS, runContext, runRequest } from '../run.test-support.ts';
import { localHttp } from './http.ts';
import { runLocalCommand } from './command.ts';

vi.mock('./http.ts', () => ({ localHttp: vi.fn() }));
vi.mock('./command.ts', () => ({ runLocalCommand: vi.fn() }));
const http = vi.mocked(localHttp);
let root: string;
// 道具は呼ぶたびに本物の sandbox-exec を確かめるので、実際に道具を動かすテストは macOS だけで行う
pretendMacOS();
const response = (content: object) => http.mockResolvedValueOnce({ status: 200, text: JSON.stringify(content) });
const action = (value: object) =>
  response({ message: { content: JSON.stringify(value) }, prompt_eval_count: 10, eval_count: 5 });

beforeEach(async () => {
  vi.clearAllMocks();
  root = await realpath(await mkdtemp(join(tmpdir(), 'ollama-worker-')));
  await mkdir(join(root, 'work'));
  response({ models: [{ model: 'deepseek-r1:8b', capabilities: ['completion', 'thinking'] }] });
});
afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});
const request = () => ({
  ...runRequest('ollama'),
  options: { enableTools: true, operationCheck: false },
  workspace: join(root, 'work'),
  stateDir: join(root, 'state'),
});

describe('Ollama worker', () => {
  it.skipIf(!REAL_MACOS)('ネイティブツール非対応のDeepSeekでも実ファイルを変更し、結果を読んで回答する', async () => {
    action({ type: 'tool', tool: 'write_file', path: 'result.txt', content: '実際の成果物' });
    action({ type: 'tool', tool: 'read_file', path: 'result.txt' });
    action({ type: 'final', text: '保存と確認が完了しました' });
    const context = runContext();
    await expect(ollamaAdapter.run(request(), context)).resolves.toBe('保存と確認が完了しました');
    expect(await readFile(join(root, 'work/result.txt'), 'utf8')).toBe('実際の成果物');
    const body = JSON.parse(http.mock.calls[3]?.[2] ?? '{}') as { messages: { content: string }[] };
    expect(body.messages.at(-1)?.content).toContain('実際の成果物');
    expect(context.onUsage).toHaveBeenCalledTimes(4);
  });

  it.skipIf(!REAL_MACOS)('拒否した範囲外操作を成功として返さない', async () => {
    action({ type: 'tool', tool: 'write_file', path: '../outside.txt', content: '拒否' });
    await expect(ollamaAdapter.run(request(), runContext())).rejects.toHaveProperty('code', 'unsupported_permission');
    await expect(readFile(join(root, 'outside.txt'))).rejects.toHaveProperty('code', 'ENOENT');
    expect(http).toHaveBeenCalledTimes(2);
  });

  it.skipIf(!REAL_MACOS)('コマンドの実行結果と途中投稿を往復させる', async () => {
    vi.mocked(runLocalCommand).mockResolvedValueOnce('{"exitCode":0,"output":"ok"}');
    action({ type: 'tool', tool: 'post', text: '確認中です' });
    action({ type: 'tool', tool: 'run_command', command: 'git diff --stat' });
    action({ type: 'final', text: '確認しました' });
    const context = runContext();
    const req = request();
    await ollamaAdapter.run(req, context);
    expect(context.onPost).toHaveBeenCalledWith('確認中です');
    expect(runLocalCommand).toHaveBeenCalledWith(req, 'git diff --stat', expect.any(AbortSignal));
    expect(http.mock.calls[3]?.[2]).toContain('exitCode');
  });

  it.skipIf(!REAL_MACOS)('スキル本文と付属ファイルを提供し、実行後に管理領域を片付ける', async () => {
    action({ type: 'tool', tool: 'read_skill', name: 'example' });
    action({ type: 'final', text: '参照しました' });
    const req = {
      ...request(),
      skills: [
        {
          name: 'example',
          description: '例',
          body: '手順です',
          dir: null,
          files: [{ path: 'data.txt', content: 'data' }],
        },
      ],
    };
    await ollamaAdapter.run(req, runContext());
    expect(http.mock.calls[2]?.[2]).toContain('手順です');
    const { readdir } = await import('node:fs/promises');
    expect(await readdir(req.stateDir)).toEqual([]);
  });

  it('不正な操作のJSONを実行しない', async () => {
    response({ message: { content: '{invalid' } });
    await expect(ollamaAdapter.run(request(), runContext())).rejects.toThrow('操作要求');
    expect(runLocalCommand).not.toHaveBeenCalled();
  });

  it('実行中のキャンセル後に次の操作を実行しない', async () => {
    const controller = new AbortController();
    vi.mocked(runLocalCommand).mockImplementationOnce(() => {
      controller.abort();
      return Promise.reject(new Error('cancel'));
    });
    action({ type: 'tool', tool: 'run_command', command: 'test' });
    await expect(ollamaAdapter.run(request(), runContext(controller.signal))).rejects.toHaveProperty(
      'name',
      'AbortError',
    );
    expect(http).toHaveBeenCalledTimes(2);
  });

  it('操作を続けるモデルは上限で止め、完了したと報告しない', async () => {
    for (let i = 0; i < 40; i++) action({ type: 'tool', tool: 'post', text: '作業中' });
    await expect(ollamaAdapter.run(request(), runContext())).rejects.toThrow('上限');
    expect(http).toHaveBeenCalledTimes(41);
  });
});
