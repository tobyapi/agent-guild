// run 要求 → Claude Agent SDK の query() のオプション。

import type { Options } from '@anthropic-ai/claude-agent-sdk';
import { logInfo } from '../../log.ts';
import { EFFORT_OPTION, type Permissions } from '../../protocol.ts';
import { optionChoice, optionPositiveInt, type RunRequest } from '../types.ts';
import { CHECKED_TOOLS, checkedPolicy, checksOperations } from './check.ts';
import { claudeEnv } from './env.ts';
import { claudeJudge } from './judge.ts';
import { fileAccessPolicy } from './permissions.ts';
import { POST_SERVER, POST_TOOL, postServer } from './post.ts';

export const DEFAULT_MODEL = 'sonnet';
/** Claude Code の推論の深さ（浅い順）。backendOptions の effort はこのどれか */
export const CLAUDE_EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max'] as const;
/** 暴走を防ぐ既定のターン上限（options.maxTurns で上書きできる） */
export const DEFAULT_MAX_TURNS = 30;

/** 権限ごとに使える組み込みツール */
const PERMISSION_TOOLS: readonly (readonly [keyof Permissions, readonly string[]])[] = [
  ['webSearch', ['WebSearch']],
  ['webFetch', ['WebFetch']],
  ['readFiles', ['Read', 'Glob', 'Grep']],
  ['writeFiles', ['Write', 'Edit']],
  ['runCommands', ['Bash']],
  ['skills', ['Skill']],
];
/** パスを扱わないので、確認なしで許すツール（Skill は skills オプションが許す） */
const PATHLESS_TOOLS = new Set(['WebSearch', 'WebFetch', 'Bash']);

/** 読み書きの権限がなくても、作業場所の MEMORY.md のために使えるツール（canUseTool が MEMORY.md だけに絞る） */
const MEMORY_TOOLS = ['Read', 'Write', 'Edit'];

export function toolsFor(permissions: Permissions): string[] {
  const granted = PERMISSION_TOOLS.flatMap(([permission, tools]) => (permissions[permission] ? [...tools] : []));
  return [...granted, ...MEMORY_TOOLS.filter((tool) => !granted.includes(tool))];
}

/** 1回の実行に固有のもの */
export interface ClaudeRun {
  abortController: AbortController;
  /** スキルを入れたローカルプラグイン（スキルを使わないなら null） */
  pluginDir: string | null;
  /** 投稿ツールで投稿された文章を受け取る */
  onPost: (text: string) => void;
  /** 使う Claude Code の実行ファイル（利用者の環境のもの。executable.ts） */
  executable: string;
}

export function claudeOptions(request: RunRequest, { abortController, pluginDir, onPost, executable }: ClaudeRun): Options {
  const { permissions } = request;
  const tools = toolsFor(permissions);
  // 操作の確認をするなら、コマンドと Web ページを開くことも canUseTool を通す（judge.ts のモデルに確かめる）
  const checking = checksOperations(request);
  const preApproved = (tool: string) => PATHLESS_TOOLS.has(tool) && !(checking && tool in CHECKED_TOOLS);
  return {
    pathToClaudeCodeExecutable: executable,
    cwd: request.workspace,
    additionalDirectories: permissions.readFiles ? request.readableDirs : [],
    model: request.model || DEFAULT_MODEL,
    // 選ばなければ Claude Code の既定（settingSources: [] なので、利用者の Claude Code の設定の深さは使わない）
    effort: optionChoice(request.options, EFFORT_OPTION, CLAUDE_EFFORTS),
    systemPrompt: request.systemPrompt,
    // tools は使える組み込みツールの集合。ファイル操作は canUseTool がパスで判定する
    tools,
    // 途中の投稿ツールはパスを扱わないので、確認なしで許す
    allowedTools: [...tools.filter(preApproved), POST_TOOL],
    mcpServers: { [POST_SERVER]: postServer(onPost) },
    canUseTool: checking
      ? checkedPolicy(request, claudeJudge(request, executable, abortController.signal), onPost)
      : fileAccessPolicy(request),
    permissionMode: 'default',
    // 作業場所の .claude/settings.json・hooks・CLAUDE.md を読ませない（エージェントが書き換えても次の実行に影響しない）
    settingSources: [],
    plugins: pluginDir === null ? [] : [{ type: 'local', path: pluginDir }],
    ...(permissions.skills ? { skills: 'all' as const } : {}),
    // 会話の記録は DB が持つので、~/.claude/projects にセッションを残さない
    persistSession: false,
    maxTurns: optionPositiveInt(request.options, 'maxTurns') ?? DEFAULT_MAX_TURNS,
    abortController,
    // 秘密らしい環境変数は渡さない（Bash から読まれないように。Claude Code 自身の認証に要るものは残す）
    env: { ...claudeEnv(process.env), CLAUDE_AGENT_SDK_CLIENT_APP: 'agent-guild' },
    stderr: (data) => logInfo(`[claude] ${data.trimEnd()}`),
  };
}
