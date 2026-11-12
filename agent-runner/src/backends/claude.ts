// Claude Agent SDK のアダプタ。権限は使えるツールの集合と canUseTool（パスの判定）で守り、
// スキルは stateDir に作るローカルプラグインで渡す。作業場所の設定ファイルは読ませない（settingSources: []）。
// Claude Code は利用者の環境に入っているものを使う（claude/executable.ts）。

import { query } from '@anthropic-ai/claude-agent-sdk';
import { errorMessage } from '../log.ts';
import { prepareCommandSandbox } from './command-sandbox.ts';
import { OPERATION_CHECK_OPTION } from './claude/check.ts';
import { claudeNotFound, findClaude } from './claude/executable.ts';
import { claudePrompt } from './claude/input.ts';
import { CAN_LOGIN, openLoginWindow } from './claude/login.ts';
import { consumeMessages } from './claude/messages.ts';
import { claudeCatalog } from './claude/models.ts';
import { claudeOptions, DEFAULT_MAX_TURNS } from './claude/options.ts';
import { LEAK_RISKS, permissionRules, unenforceableReason } from './claude/rules.ts';
import { writeSkillPlugin } from './claude/plugin.ts';
import { probeClaude } from './claude/probe.ts';
import { t } from './claude/texts/index.ts';
import {
  BackendError,
  NO_SETUP,
  classifyErrorText,
  rejectUnenforceable,
  type BackendAdapter,
  type BackendDescriptor,
  type LoginContext,
  type RunContext,
  type RunRequest,
} from './types.ts';

/** 画面に出る文字列は、呼んだ時点の言語で作る */
const info = (): Omit<BackendDescriptor, 'permissionRules'> => ({
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
      label: t('maxTurnsLabel'),
      description: t('maxTurnsDescription'),
      type: 'number',
      choices: [],
      default: DEFAULT_MAX_TURNS,
    },
    {
      key: OPERATION_CHECK_OPTION,
      label: t('operationCheckLabel'),
      description: t('operationCheckDescription'),
      type: 'boolean',
      choices: [],
      default: true,
    },
  ],
  leakRisks: LEAK_RISKS.map((risk) => [...risk]),
  unrestricted: [],
  midRunPost: 'tool',
  // 指定フォルダでは実行しない（点検のあとのリンクの差し替えを止められない）
  folderScope: null,
  toolsOption: null,
  local: false,
  frameGeneration: false,
  setup: {
    ...NO_SETUP,
    install: {
      cli: 'Claude Code',
      publisher: 'Anthropic',
      scriptUrl: 'https://claude.ai/install.sh',
      shell: '/bin/bash',
      binary: 'claude',
      env: {},
      docsUrl: 'https://code.claude.com/docs/ja/quickstart',
      loginCommand: 'claude auth login',
    },
    login: CAN_LOGIN ? { label: t('loginLabel'), waiting: t('loginWaiting') } : null,
  },
});

async function run(request: RunRequest, { signal, onActivity, onPost, onUsage }: RunContext): Promise<string> {
  // Dispatcher が先に止める（folderScope: null）。直接呼ばれても、指定フォルダの依頼を範囲の外で動かさない
  if (request.writableDirs !== undefined) {
    throw new BackendError('unsupported_permission', t('folderUnsupported'));
  }
  await prepareCommandSandbox();
  rejectUnenforceable('Claude', unenforceableReason(request.permissions));
  const executable = findClaude();
  if (executable === null) throw new BackendError('internal', claudeNotFound());
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
    throw new BackendError(classifyErrorText(detail), t('runFailed', { detail }));
  }
}

/** ログインの窓が閉じたら状態を確かめ、ログインできていなければ失敗にする */
async function login(context: LoginContext): Promise<void> {
  await openLoginWindow(context);
  if (context.signal.aborted) return;
  const { status } = await probeClaude();
  if (status !== 'ready') {
    throw new BackendError('auth', t('loginIncomplete'));
  }
}

export const claudeAdapter: BackendAdapter = {
  // コマンドの規則は、隔離が使える PC では要らなくなる（作業者以外の役割も、隔離の中でコマンドを使える）
  info: () => ({ ...info(), permissionRules: permissionRules() }),
  // コマンドの隔離が使えるかを先に確かめる（info() の規則が、この結果を使う）
  probe: async () => {
    await prepareCommandSandbox();
    return probeClaude();
  },
  catalog: claudeCatalog,
  run,
  login,
};
