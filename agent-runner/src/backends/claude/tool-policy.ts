// アプリが渡した道具だけを使う。canUseTool を省略する SDK の許可経路にも PreToolUse で適用する。
import type { HookCallback, Options, PermissionResult } from '@anthropic-ai/claude-agent-sdk';
import type { Permissions } from '../../protocol.ts';
import { folderFileHook } from '../folder-scope.ts';
import type { RunRequest } from '../types.ts';
import { POST_SERVER, POST_TOOL } from './post.ts';

const PERMISSION_TOOLS: readonly (readonly [keyof Permissions, readonly string[]])[] = [
  ['webSearch', ['WebSearch']],
  ['webFetch', ['WebFetch']],
  ['readFiles', ['Read', 'Glob', 'Grep']],
  ['writeFiles', ['Write', 'Edit']],
  ['runCommands', ['Bash']],
  ['skills', ['Skill']],
];
const MEMORY_TOOLS = ['Read', 'Write', 'Edit'];
const REGISTERED_TOOLS = new Set([
  ...PERMISSION_TOOLS.flatMap(([, tools]) => tools),
  // 旧 SDK のファイル道具も従来のパス判定を維持する。通常の tools には追加しない。
  'LS',
  'MultiEdit',
  'NotebookEdit',
  POST_TOOL,
]);

export function toolsFor(permissions: Permissions): string[] {
  const granted = PERMISSION_TOOLS.flatMap(([permission, tools]) => (permissions[permission] ? [...tools] : []));
  return [...granted, ...MEMORY_TOOLS.filter((tool) => !granted.includes(tool))];
}

/** 名前を完全一致で判定する。MCP サーバー名の接頭辞だけでは許可しない。 */
export function unregisteredToolDenial(toolName: string): PermissionResult | null {
  return REGISTERED_TOOLS.has(toolName)
    ? null
    : { behavior: 'deny', message: 'アプリが登録していない道具は使えません' };
}

/** パスを持たない登録済みの道具。ファイル道具は既存のパス判定へ渡す。 */
export function registeredToolResult(
  toolName: string,
  permissions: Permissions,
  input: Record<string, unknown>,
): PermissionResult | null {
  const denied = unregisteredToolDenial(toolName);
  if (denied) return denied;
  const allowed =
    toolName === POST_TOOL ||
    (toolName === 'WebSearch' && permissions.webSearch) ||
    (toolName === 'Skill' && permissions.skills);
  return allowed ? { behavior: 'allow', updatedInput: input } : null;
}

/** 許可を返さず、登録済みの道具は SDK とパス・操作の判定へ進める。 */
export function registeredToolsHook(tools: readonly string[]): HookCallback {
  const offered = new Set(tools);
  return (input) => {
    if (input.hook_event_name !== 'PreToolUse') return Promise.resolve({});
    const trustedPost =
      input.tool_name !== POST_TOOL || (input.mcp_server?.source === 'sdk' && input.mcp_server.name === POST_SERVER);
    if (offered.has(input.tool_name) && trustedPost) return Promise.resolve({});
    return Promise.resolve({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse' as const,
        permissionDecision: 'deny' as const,
        permissionDecisionReason: 'アプリが登録していない道具は使えません',
      },
    });
  };
}

/** 通常実行と、道具を一切使わない判定用モデルに同じ抑止を適用する。 */
export function isolatedToolOptions(
  tools: readonly string[],
  request?: RunRequest,
): Pick<Options, 'strictMcpConfig' | 'hooks'> {
  return {
    strictMcpConfig: true,
    hooks: {
      PreToolUse: [
        {
          hooks: [
            registeredToolsHook(tools),
            ...(request?.writableDirs === undefined ? [] : [folderFileHook(request)]),
          ],
        },
      ],
    },
  };
}
