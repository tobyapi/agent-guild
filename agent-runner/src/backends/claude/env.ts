// Claude Code に渡す環境変数。Bash はこれをそのまま受け継ぐので、秘密らしい変数は渡さない（agent-env.ts）。
// ただし Claude Code 自身の認証・設定（ANTHROPIC_*・CLAUDE_*）と、クラウド事業者経由で使うときのその事業者の変数は残す。

import { withoutSecrets } from '../agent-env.ts';

/** 事業者経由で使う印（probe.ts の認証の手段と同じ）と、そのときに残す変数の頭 */
const PROVIDER_PREFIXES: readonly (readonly [string, readonly string[]])[] = [
  ['CLAUDE_CODE_USE_BEDROCK', ['AWS_']],
  ['CLAUDE_CODE_USE_VERTEX', ['GOOGLE_', 'CLOUD_ML_', 'VERTEX_']],
  ['CLAUDE_CODE_USE_FOUNDRY', ['AZURE_']],
];

export function claudeEnv(env: NodeJS.ProcessEnv): Record<string, string> {
  const prefixes = ['ANTHROPIC_', 'CLAUDE_', ...PROVIDER_PREFIXES.flatMap(([flag, kept]) => (env[flag] ? kept : []))];
  return {
    ...withoutSecrets(env, (name) => prefixes.some((prefix) => name.toUpperCase().startsWith(prefix))),
    ENABLE_CLAUDEAI_MCP_SERVERS: 'false',
  };
}
