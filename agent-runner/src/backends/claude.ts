// Claude Agent SDK のアダプタ。権限は使えるツールの集合と canUseTool（パスの判定）で守り、
// スキルは stateDir に作るローカルプラグインで渡す。作業場所の設定ファイルは読ませない（settingSources: []）。
// Claude Code は利用者の環境に入っているものを使う（claude/executable.ts）。

import { query } from '@anthropic-ai/claude-agent-sdk';
import { errorMessage } from '../log.ts';
import { prepareCommandSandbox } from './command-sandbox.ts';
import { assertFolderScope } from './folder-scope.ts';
import { OPERATION_CHECK_OPTION } from './claude/check.ts';
import { CLAUDE_NOT_FOUND, findClaude } from './claude/executable.ts';
import { claudePrompt } from './claude/input.ts';
import { CAN_LOGIN, openLoginWindow } from './claude/login.ts';
import { consumeMessages } from './claude/messages.ts';
import { claudeCatalog } from './claude/models.ts';
import { claudeOptions, DEFAULT_MAX_TURNS } from './claude/options.ts';
import { LEAK_RISKS, permissionRules, unenforceableReason } from './claude/rules.ts';
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

const INFO: Omit<BackendDescriptor, 'permissionRules'> = {
  id: 'claude',
  label: 'Claude',
  capabilities: {
    webSearch: true,
    webFetch: true,
    readFiles: true,
    readAnywhere: true,
    writeFiles: true,
    writeAnywhere: true,
    runCommands: true,
    skills: true,
  },
  options: [
    {
      key: 'maxTurns',
      label: '最大ターン数',
      description: '1回の返答でツールを使って往復できる回数の上限',
      type: 'number',
      choices: [],
      default: DEFAULT_MAX_TURNS,
    },
    {
      key: OPERATION_CHECK_OPTION,
      label: '操作の確認',
      description:
        'コマンドの実行・Web ページを開く・作業フォルダの外への書き込みの前に、小さいモデル（Haiku）で依頼に沿っているかを確かめ、怪しければ止めます（人間には聞きません）',
      type: 'boolean',
      choices: [],
      default: true,
    },
  ],
  leakRisks: LEAK_RISKS.map((risk) => [...risk]),
  unrestricted: [],
  canLogin: CAN_LOGIN,
  midRunPost: 'tool',
};

async function run(request: RunRequest, { signal, onActivity, onPost, onUsage }: RunContext): Promise<string> {
  await prepareCommandSandbox();
  rejectUnenforceable('Claude', unenforceableReason(request.permissions));
  const executable = findClaude();
  if (executable === null) throw new BackendError('internal', CLAUDE_NOT_FOUND);
  const abortController = new AbortController();
  if (signal.aborted) abortController.abort();
  else signal.addEventListener('abort', () => abortController.abort(), { once: true });
  try {
    const pluginDir = request.permissions.skills ? await writeSkillPlugin(request.stateDir, request.skills) : null;
    const options = claudeOptions(request, { abortController, pluginDir, onPost, onUsage, executable });
    const prompt = await claudePrompt(request.prompt, request.images);
    if (options.model) onUsage({ model: options.model });
    return await consumeMessages(query({ prompt, options }), onActivity, onUsage);
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
    throw new BackendError(
      'auth',
      'Claude のログインが完了しませんでした。開いた窓とブラウザで、ログインを最後まで進めてください',
    );
  }
}

export const claudeAdapter: BackendAdapter = {
  // コマンドの規則は、隔離が使える PC では要らなくなる（作業者以外の役割も、隔離の中でコマンドを使える）
  info: () => ({ ...INFO, permissionRules: permissionRules() }),
  // コマンドの隔離が使えるかを先に確かめる（info() の規則が、この結果を使う）
  probe: async () => {
    await prepareCommandSandbox();
    return probeClaude();
  },
  catalog: claudeCatalog,
  run,
  // 指定フォルダでは実行しない（点検のあとのリンクの差し替えを止められない）。理由を付けて断る
  folderScope: assertFolderScope,
  login,
};
