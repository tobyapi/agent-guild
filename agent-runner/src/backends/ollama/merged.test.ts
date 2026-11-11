import { mkdir, mkdtemp, readFile, readdir, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ollamaAdapter } from '../ollama.ts';
import { folderModeAvailable, pretendMacOS, REAL_MACOS, runContext, runRequest } from '../run.test-support.ts';
import { localHttp } from './http.ts';
import { fileTool } from './files.ts';
import { runLocalCommand } from './command.ts';
vi.mock('./http.ts', () => ({ localHttp: vi.fn() }));
const http = vi.mocked(localHttp);
const response = (body: object) => http.mockResolvedValueOnce({ status: 200, text: JSON.stringify(body) });
const action = (body: object) => response({ message: { content: JSON.stringify(body) } });
let root: string;
beforeEach(async () => {
  http.mockReset();
  root = await realpath(await mkdtemp(join(tmpdir(), 'ollama-merge-')));
  await mkdir(join(root, 'work'));
});
afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});
const request = () => ({
  ...runRequest('ollama'),
  workspace: join(root, 'work'),
  stateDir: join(root, 'state'),
  options: { enableTools: true, operationCheck: false },
});
const startJson = () => response({ models: [{ model: 'deepseek', capabilities: ['completion'] }] });

it('opt-in前のJSON操作は実行せず、形式制約も渡さない', async () => {
  startJson();
  action({ type: 'tool', tool: 'write_file', path: 'bad', content: 'bad' });
  await ollamaAdapter.run({ ...request(), options: {} }, runContext());
  expect(await readdir(join(root, 'work'))).toEqual([]);
  expect(JSON.parse(http.mock.calls[1]?.[2] ?? '{}')).not.toHaveProperty('format');
});

// コマンドを使う分岐（macOS）。確認で止まるので実行には進まず、ほかの OS でも同じ分岐を通す
describe('コマンドの操作確認', () => {
  pretendMacOS();
  it('JSONコマンドでも既定の操作確認が拒否したら実行しない', async () => {
    startJson();
    action({ type: 'tool', tool: 'run_command', command: 'printf bad > bad' });
    response({ message: { content: 'DENY' } });
    await expect(ollamaAdapter.run({ ...request(), options: { enableTools: true } }, runContext())).rejects.toThrow(
      '確認',
    );
    expect(await readdir(join(root, 'work'))).toEqual([]);
  });
});

it.skipIf(!(await folderModeAvailable()))('JSON経路も指定フォルダだけに保存し、相談メモを拒否する', async () => {
  const project = join(root, 'project');
  const peer = join(root, 'peer');
  await mkdir(project);
  await mkdir(peer);
  await writeFile(join(peer, 'MEMORY.md'), 'private');
  const req = {
    ...request(),
    writableDirs: [project],
    readableDirs: [project, peer],
    permissions: { ...request().permissions, runCommands: false, skills: false },
  };
  startJson();
  action({ type: 'tool', tool: 'write_file', path: join(project, 'artifact.txt'), content: 'shared' });
  action({ type: 'tool', tool: 'read_file', path: join(peer, 'MEMORY.md') });
  await expect(ollamaAdapter.run(req, runContext())).rejects.toThrow('MEMORY');
  expect(await readFile(join(project, 'artifact.txt'), 'utf8')).toBe('shared');
  expect(await readFile(join(peer, 'MEMORY.md'), 'utf8')).toBe('private');
});

it.each(['runCommands', 'skills'] as const)(
  'JSON経路でも指定フォルダと%sの併用を起動時に拒否する',
  async (permission) => {
    const req = request();
    req.permissions.runCommands = false;
    req.permissions.skills = false;
    req.permissions[permission] = true;
    await expect(ollamaAdapter.run({ ...req, writableDirs: [] }, runContext())).rejects.toThrow('両立');
    expect(http).not.toHaveBeenCalled();
  },
);

it('MEMORY例外をリンク先の別ファイルの書き換えに使えない', async () => {
  const req = request();
  req.permissions.writeFiles = false;
  await writeFile(join(req.workspace, 'keep'), 'keep');
  await symlink(join(req.workspace, 'keep'), join(req.workspace, 'MEMORY.md'));
  await expect(fileTool(req, 'write_file', 'MEMORY.md', 'bad', new AbortController().signal)).rejects.toHaveProperty(
    'code',
    'unsupported_permission',
  );
  expect(await readFile(join(req.workspace, 'keep'), 'utf8')).toBe('keep');
});

it('ネイティブ経路でもスキル参照と途中投稿を提供する', async () => {
  response({ models: [{ model: 'native', capabilities: ['completion', 'tools'] }] });
  response({ capabilities: ['completion', 'tools'] });
  response({
    message: {
      tool_calls: [
        { function: { name: 'read_skill', arguments: { name: 'example' } } },
        { function: { name: 'post', arguments: { text: '途中です' } } },
      ],
    },
  });
  response({ message: { content: '完了' } });
  const context = runContext();
  await expect(
    ollamaAdapter.run(
      { ...request(), skills: [{ name: 'example', description: '例', body: 'CODE-7319', dir: null, files: [] }] },
      context,
    ),
  ).resolves.toBe('完了');
  expect(context.onPost).toHaveBeenCalledWith('途中です');
  expect(http.mock.calls[3]?.[2]).toContain('CODE-7319');
});

it('展開したスキルの付属ファイルをJSON経路から読み、終了時に片付ける', async () => {
  startJson();
  http.mockImplementationOnce((_path, _signal, body) => {
    const text = (JSON.parse(body ?? '{}') as { messages: { content: string }[] }).messages[0]!.content;
    // The model sees the skill catalog first; return read_skill to discover the prepared path.
    expect(text).toContain('example');
    return Promise.resolve({
      status: 200,
      text: JSON.stringify({
        message: { content: JSON.stringify({ type: 'tool', tool: 'read_skill', name: 'example' }) },
      }),
    });
  });
  http.mockImplementationOnce((_path, _signal, body) => {
    const history = (JSON.parse(body ?? '{}') as { messages: { content: string }[] }).messages;
    const path = /付属ファイル: (.+)/.exec(history.at(-1)?.content ?? '')?.[1];
    expect(path).toBeTruthy();
    return Promise.resolve({
      status: 200,
      text: JSON.stringify({
        message: { content: JSON.stringify({ type: 'tool', tool: 'read_file', path: join(path!, 'data.txt') }) },
      }),
    });
  });
  action({ type: 'final', text: '参照済み' });
  const req = {
    ...request(),
    skills: [
      {
        name: 'example',
        description: '例',
        body: '手順',
        dir: null,
        files: [{ path: 'data.txt', content: 'ATTACHMENT-7319' }],
      },
    ],
  };
  await ollamaAdapter.run(req, runContext());
  expect(http.mock.calls[3]?.[2]).toContain('ATTACHMENT-7319');
  expect(await readdir(req.stateDir)).toEqual([]);
});

it('tools対応を申告するモデルでもJSON操作を明示して実ファイルを保存できる', async () => {
  response({ models: [{ model: 'deepseek', capabilities: ['completion', 'tools'] }] });
  response({ capabilities: ['completion', 'tools'] });
  action({ type: 'tool', tool: 'write_file', path: 'forced-json', content: 'verified' });
  action({ type: 'final', text: '完了' });
  const req = request();
  await ollamaAdapter.run({ ...req, options: { ...req.options, toolProtocol: 'json' } }, runContext());
  const body: unknown = JSON.parse(http.mock.calls[2]?.[2] ?? '{}');
  expect(body).toHaveProperty('format');
  expect(body).not.toHaveProperty('tools');
  expect(await readFile(join(req.workspace, 'forced-json'), 'utf8')).toBe('verified');
});

it.skipIf(!REAL_MACOS)('MEMORYのファイル例外をコマンドの書き込み権限へ広げない', async () => {
  const req = request();
  req.permissions.writeFiles = false;
  const result = JSON.parse(await runLocalCommand(req, 'printf bad > MEMORY.md', new AbortController().signal)) as {
    exitCode: number;
  };
  expect(result.exitCode).not.toBe(0);
  await expect(readFile(join(req.workspace, 'MEMORY.md'))).rejects.toHaveProperty('code', 'ENOENT');
});
