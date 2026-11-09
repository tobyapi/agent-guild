// run 要求 → Claude Agent SDK の query() のオプション。

import type { Options } from '@anthropic-ai/claude-agent-sdk';
import { logInfo } from '../../log.ts';
import type { Permissions } from '../../protocol.ts';
import { optionPositiveInt, type RunRequest } from '../types.ts';
import { fileAccessPolicy } from './permissions.ts';

export const DEFAULT_MODEL = 'sonnet';
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

export function toolsFor(permissions: Permissions): string[] {
  return PERMISSION_TOOLS.flatMap(([permission, tools]) => (permissions[permission] ? [...tools] : []));
}

/** pluginDir はスキルを入れたローカルプラグイン（スキルを使わないなら null） */
export function claudeOptions(request: RunRequest, abortController: AbortController, pluginDir: string | null): Options {
  const { permissions } = request;
  const tools = toolsFor(permissions);
  return {
    cwd: request.workspace,
    additionalDirectories: permissions.readFiles ? request.readableDirs : [],
    model: request.model || DEFAULT_MODEL,
    systemPrompt: request.systemPrompt,
    // tools は使える組み込みツールの集合。ファイル操作は canUseTool がパスで判定する
    tools,
    allowedTools: tools.filter((tool) => PATHLESS_TOOLS.has(tool)),
    canUseTool: fileAccessPolicy(request),
    permissionMode: 'default',
    // 作業場所の .claude/settings.json・hooks・CLAUDE.md を読ませない（エージェントが書き換えても次の実行に影響しない）
    settingSources: [],
    plugins: pluginDir === null ? [] : [{ type: 'local', path: pluginDir }],
    ...(permissions.skills ? { skills: 'all' as const } : {}),
    // 会話の記録は DB が持つので、~/.claude/projects にセッションを残さない
    persistSession: false,
    maxTurns: optionPositiveInt(request.options, 'maxTurns') ?? DEFAULT_MAX_TURNS,
    abortController,
    env: { ...process.env, CLAUDE_AGENT_SDK_CLIENT_APP: 'agent-guild' },
    stderr: (data) => logInfo(`[claude] ${data.trimEnd()}`),
  };
}
