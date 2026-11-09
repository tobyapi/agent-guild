// Claude Agent SDK のアダプタ。権限は使えるツールの集合と canUseTool（パスの判定）で守り、
// スキルは stateDir に作るローカルプラグインで渡す。作業場所の設定ファイルは読ませない（settingSources: []）。
// Claude Code は利用者の環境に入っているものを使う（claude/executable.ts）。

import { query } from '@anthropic-ai/claude-agent-sdk';
import { errorMessage } from '../log.ts';
import { CLAUDE_NOT_FOUND, findClaude } from './claude/executable.ts';
import { claudePrompt } from './claude/input.ts';
import { CAN_LOGIN, openLoginWindow } from './claude/login.ts';
import { consumeMessages } from './claude/messages.ts';
import { claudeOptions, DEFAULT_MAX_TURNS, DEFAULT_MODEL } from './claude/options.ts';
import { PERMISSION_RULES, unenforceableReason } from './claude/permissions.ts';
import { writeSkillPlugin } from './claude/plugin.ts';
import { probeClaude } from './claude/probe.ts';
import {
  BackendError,
  classifyErrorText,
  rejectUnenforceable,
  type BackendAdapter,
  type BackendDescriptor,
  type LoginContext,
  type RunContext,
  type RunRequest,
} from './types.ts';

const INFO: BackendDescriptor = {
  id: 'claude',
  label: 'Claude',
  modelSuggestions: ['sonnet', 'opus', 'haiku'],
  defaultModel: DEFAULT_MODEL,
  capabilities: { webSearch: true, webFetch: true, readFiles: true, writeFiles: true, writeAnywhere: true, runCommands: true, skills: true },
  options: [
    {
      key: 'maxTurns',
      label: '最大ターン数',
      description: '1回の返答でツールを使って往復できる回数の上限',
      type: 'number',
      choices: [],
      default: DEFAULT_MAX_TURNS,
    },
  ],
  permissionRules: [...PERMISSION_RULES],
  canLogin: CAN_LOGIN,
  midRunPost: 'tool',
};

async function run(request: RunRequest, { signal, onActivity, onPost }: RunContext): Promise<string> {
  rejectUnenforceable('Claude', unenforceableReason(request.permissions));
  const executable = findClaude();
  if (executable === null) throw new BackendError('internal', CLAUDE_NOT_FOUND);
  const abortController = new AbortController();
  if (signal.aborted) abortController.abort();
  else signal.addEventListener('abort', () => abortController.abort(), { once: true });
  try {
    const pluginDir = request.permissions.skills ? await writeSkillPlugin(request.stateDir, request.skills) : null;
    const options = claudeOptions(request, { abortController, pluginDir, onPost, executable });
    const prompt = await claudePrompt(request.prompt, request.images);
    return await consumeMessages(query({ prompt, options }), onActivity);
  } catch (error) {
    if (error instanceof BackendError || signal.aborted) throw error;
    const detail = errorMessage(error);
    throw new BackendError(classifyErrorText(detail), `Claude を実行できませんでした（${detail}）`);
  }
}

/** ログインの窓が閉じたら状態を確かめ、ログインできていなければ失敗にする */
async function login(context: LoginContext): Promise<void> {
  await openLoginWindow(context);
  if (context.signal.aborted) return;
  const { status } = await probeClaude();
  if (status !== 'ready') {
    throw new BackendError('auth', 'Claude のログインが完了しませんでした。開いた窓とブラウザで、ログインを最後まで進めてください');
  }
}

export const claudeAdapter: BackendAdapter = {
  info: () => INFO,
  probe: probeClaude,
  run,
  login,
};
