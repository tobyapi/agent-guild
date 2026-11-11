import { describe, expect, it } from 'vitest';
import type { Permissions } from '../../protocol.ts';
import type { RunRequest } from '../types.ts';
import { codexConfig, threadInput, threadOptions, unenforceableReason } from './options.ts';

const WORKER: Permissions = {
  webSearch: true,
  webFetch: true,
  readFiles: true,
  readAnywhere: false,
  writeFiles: true,
  writeAnywhere: false,
  runCommands: true,
  skills: true,
};
const EXPERT: Permissions = { ...WORKER, writeFiles: false, runCommands: false };

const request = (permissions: Permissions, options: Record<string, unknown> = {}, model = ''): RunRequest => ({
  type: 'run',
  id: 'j1',
  backend: 'codex',
  workspace: '/data/a1/work',
  stateDir: '/data/a1/state/codex',
  readableDirs: ['/data/a0/work'],
  systemPrompt: 'あなたはソラだ',
  prompt: '実装して',
  intent: '',
  model,
  permissions,
  skills: [],
  images: [],
  options,
});

describe('threadOptions', () => {
  it('作業者（runCommands あり）は workspace-write・Web 検索あり・ネットワークあり', () => {
    expect(threadOptions(request(WORKER, { effort: 'high' }))).toEqual({
      workingDirectory: '/data/a1/work',
      skipGitRepoCheck: true,
      sandboxMode: 'workspace-write',
      approvalPolicy: 'never',
      webSearchMode: 'live',
      networkAccessEnabled: true,
      model: undefined,
      modelReasoningEffort: 'high',
    });
  });

  it('専門家も MEMORY.md のために workspace-write。Web の権限がなければ検索もネットワークも閉じる。readableDirs は渡さない', () => {
    const options = threadOptions(
      request({ ...EXPERT, webSearch: false, webFetch: false }, { effort: 'deepest' }, 'gpt-x'),
    );
    expect(options).toMatchObject({
      sandboxMode: 'workspace-write',
      webSearchMode: 'disabled',
      networkAccessEnabled: false,
      model: 'gpt-x',
    });
    expect(options.modelReasoningEffort, 'SDK が受け付けない深さは渡さない').toBeUndefined();
    expect(options).not.toHaveProperty('additionalDirectories');
  });

  it('モデルと深さを選んでいなければ、一覧の既定を明示して渡す（Codex の config.toml の既定は使わない）', () => {
    const catalog = {
      defaultModel: 'gpt-a',
      models: [
        { id: 'gpt-a', label: 'A', description: '', efforts: ['low', 'high'], defaultEffort: 'low' },
        { id: 'gpt-b', label: 'B', description: '', efforts: ['medium'], defaultEffort: 'medium' },
      ],
    };
    expect(threadOptions(request(WORKER), catalog)).toMatchObject({ model: 'gpt-a', modelReasoningEffort: 'low' });
    expect(threadOptions(request(WORKER, {}, 'gpt-b'), catalog)).toMatchObject({
      model: 'gpt-b',
      modelReasoningEffort: 'medium',
    });
    expect(threadOptions(request(WORKER, { effort: 'high' }, 'gpt-a'), catalog)).toMatchObject({
      modelReasoningEffort: 'high',
    });
    expect(threadOptions(request(WORKER, {}, 'custom'), catalog)).toMatchObject({
      model: 'custom',
      modelReasoningEffort: undefined,
    });
  });
});

describe('threadOptions の sandbox', () => {
  it('作業場所の外にも書くなら sandbox を外す。書き込みがなければ外さない', () => {
    const anywhere = { ...WORKER, writeAnywhere: true };
    expect(threadOptions(request(anywhere))).toMatchObject({
      sandboxMode: 'danger-full-access',
      networkAccessEnabled: true,
    });
    expect(threadOptions(request({ ...EXPERT, writeAnywhere: true }))).toMatchObject({
      sandboxMode: 'workspace-write',
    });
  });
});

describe('指定フォルダのチャンネル', () => {
  const folder = { ...request({ ...WORKER, skills: false }), writableDirs: ['/src/project'] };

  it('sandbox とネットワークの指定を渡さない（権限プロファイルで決める。併用できない）', () => {
    const options = threadOptions(folder);
    expect(options.sandboxMode).toBeUndefined();
    expect(options.networkAccessEnabled).toBeUndefined();
    expect(options).toMatchObject({ workingDirectory: '/data/a1/work', approvalPolicy: 'never' });
  });

  it('スキルの権限がなくても受け付ける（利用者全体のスキルの場所を読めない）。ほかの規則は同じ', () => {
    expect(unenforceableReason(folder.permissions, true)).toBeNull();
    expect(unenforceableReason(folder.permissions)).toContain('スキル');
    expect(unenforceableReason({ ...folder.permissions, runCommands: false }, true)).toContain('runCommands');
  });
});

describe('threadInput', () => {
  it('画像がなければ本文の文字列、あれば本文のあとに画像のファイルを発言の順に並べる', () => {
    expect(threadInput(request(WORKER))).toBe('実装して');
    const images = [
      { path: '/data/attachments/c1/a.png', mediaType: 'image/png' },
      { path: '/data/attachments/c1/b.jpg', mediaType: 'image/jpeg' },
    ];
    expect(threadInput({ ...request(WORKER), images })).toEqual([
      { type: 'text', text: '実装して' },
      { type: 'local_image', path: '/data/attachments/c1/a.png' },
      { type: 'local_image', path: '/data/attachments/c1/b.jpg' },
    ]);
  });
});

describe('codexConfig', () => {
  it('人格は developer_instructions、作業場所の AGENTS.md は無視、一時フォルダへの書き込みは除外', () => {
    expect(codexConfig(request(WORKER))).toMatchObject({
      developer_instructions: 'あなたはソラだ',
      project_doc_max_bytes: 0,
      sandbox_workspace_write: { exclude_tmpdir_env_var: true, exclude_slash_tmp: true },
    });
  });

  it('コマンドには秘密らしい環境変数を渡さない（Codex の既定の除外には頼らない）', () => {
    const { shell_environment_policy: policy } = codexConfig(request(WORKER)) as {
      shell_environment_policy: { exclude: string[] };
    };
    expect(policy.exclude).toEqual(expect.arrayContaining(['*PASSWORD*', '*CREDENTIAL*', 'AUTH', '*_AUTH_*', '*_PAT']));
  });
});

describe('unenforceableReason', () => {
  it('作業者は runCommands つきなら、専門家はそのままで受け付ける', () => {
    expect(unenforceableReason(WORKER)).toBeNull();
    expect(unenforceableReason(EXPERT)).toBeNull();
  });

  it('書き込みだけ許してコマンドを禁じることはできない', () => {
    expect(unenforceableReason({ ...WORKER, runCommands: false })).toContain('runCommands');
  });

  it('作業場所の外への書き込みは、書き込みと Web 閲覧（ネットワーク）も許すときだけ守れる', () => {
    expect(unenforceableReason({ ...WORKER, writeAnywhere: true })).toBeNull();
    expect(unenforceableReason({ ...WORKER, writeAnywhere: true, webFetch: false })).toContain('webFetch');
    expect(unenforceableReason({ ...EXPERT, writeAnywhere: true })).toContain('writeFiles');
  });

  it('読み取りとスキルは止められない', () => {
    expect(unenforceableReason({ ...EXPERT, readFiles: false })).toContain('読み取り');
    expect(unenforceableReason({ ...EXPERT, skills: false })).toContain('スキル');
  });
});
