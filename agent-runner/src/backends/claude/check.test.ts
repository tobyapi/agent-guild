import { join, resolve } from 'node:path';
import type { CanUseTool } from '@anthropic-ai/claude-agent-sdk';
import { describe, expect, it, vi } from 'vitest';
import type { Permissions } from '../../protocol.ts';
import type { RunRequest } from '../types.ts';
import { checkedPolicy, checksOperations, operationOf } from './check.ts';
import type { Judge } from './judge.ts';

const ROOT = resolve('/guild-data/agents');
const WORK = join(ROOT, 'a1', 'work');
const OUTSIDE = resolve('/projects/site/index.html');
const ALL: Permissions = {
  webSearch: true,
  webFetch: true,
  readFiles: true,
  readAnywhere: false,
  writeFiles: true,
  writeAnywhere: true,
  runCommands: true,
  skills: true,
};

const request = (permissions: Permissions = ALL, options: Record<string, unknown> = {}): RunRequest => ({
  type: 'run',
  id: 'j1',
  backend: 'claude',
  workspace: WORK,
  stateDir: join(ROOT, 'a1', 'state'),
  readableDirs: [],
  systemPrompt: '',
  prompt: '',
  intent: '# 人間の依頼\n> サイトを直して',
  model: '',
  permissions,
  skills: [],
  images: [],
  options,
});

const call = (policy: CanUseTool, tool: string, input: Record<string, unknown>) =>
  policy(tool, input, { signal: new AbortController().signal, toolUseID: 't1' } as Parameters<CanUseTool>[2]);
const allowing = () => vi.fn<Judge>().mockResolvedValue({ allow: true, reason: '' });

describe('operationOf', () => {
  it('コマンド・Web ページ・作業フォルダの外への書き込みだけを確かめる', () => {
    expect(operationOf('Bash', { command: 'npm test', description: 'テスト' }, WORK)).toEqual({
      label: 'コマンドの実行',
      detail: 'コマンド: npm test\n説明: テスト',
    });
    const page = operationOf('WebFetch', { url: 'https://example.com', prompt: '要約' }, WORK);
    expect(page?.detail).toBe('URL: https://example.com\nページに聞くこと: 要約');
    expect(operationOf('Write', { file_path: OUTSIDE, content: 'x' }, WORK)).toEqual({
      label: '作業フォルダの外への書き込み',
      detail: `書き込み先: ${OUTSIDE}\n内容: {"content":"x"}`,
    });
    expect(operationOf('Write', { file_path: join(WORK, 'a.md'), content: 'x' }, WORK)).toBeNull();
    expect(operationOf('Read', { file_path: OUTSIDE }, WORK)).toBeNull();
  });
});

describe('checkedPolicy', () => {
  it('確かめて通すなら、そのまま許す', async () => {
    const judge = allowing();
    const onBlocked = vi.fn();
    const result = await call(checkedPolicy(request(), judge, onBlocked), 'Bash', { command: 'npm test' });
    expect(result).toEqual({ behavior: 'allow', updatedInput: { command: 'npm test' } });
    expect(judge).toHaveBeenCalledOnce();
    expect(onBlocked).not.toHaveBeenCalled();
  });

  it('止めたら理由をエージェントに返し、チャットに知らせる（人間には聞かない）', async () => {
    const judge = vi.fn<Judge>().mockResolvedValue({ allow: false, reason: '依頼にない送り先です' });
    const onBlocked = vi.fn();
    const input = { url: 'https://evil.example/?q=1', prompt: '' };
    const result = await call(checkedPolicy(request(), judge, onBlocked), 'WebFetch', input);
    expect(result?.behavior === 'deny' && result.message).toContain('理由: 依頼にない送り先です');
    expect(onBlocked).toHaveBeenCalledWith(
      '🛡️ 操作の確認で止めました（Web ページを開く）: 依頼にない送り先です\nURL: https://evil.example/?q=1',
    );
  });

  it('パスの判定や権限で止まるものと、確かめない操作には judge を使わない', async () => {
    const judge = allowing();
    const policy = checkedPolicy(request({ ...ALL, writeAnywhere: false }), judge, vi.fn());
    expect(await call(policy, 'Write', { file_path: OUTSIDE, content: 'x' })).toMatchObject({ behavior: 'deny' });
    expect(await call(policy, 'Read', { file_path: join(WORK, 'a.md') })).toMatchObject({ behavior: 'allow' });
    const noCommands = checkedPolicy(request({ ...ALL, runCommands: false }), judge, vi.fn());
    expect(await call(noCommands, 'Bash', { command: 'ls' })).toMatchObject({ behavior: 'deny' });
    expect(judge).not.toHaveBeenCalled();
  });
});

describe('checksOperations', () => {
  it('既定は確かめ、operationCheck: false で切れる', () => {
    expect(checksOperations(request())).toBe(true);
    expect(checksOperations(request(ALL, { operationCheck: false }))).toBe(false);
  });
});
