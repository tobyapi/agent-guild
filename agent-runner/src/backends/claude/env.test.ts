import { describe, expect, it } from 'vitest';
import { claudeEnv } from './env.ts';

describe('claudeEnv', () => {
  it('親の設定が true でも、この実行の claude.ai 連携は無効にする', () => {
    expect(claudeEnv({ ENABLE_CLAUDEAI_MCP_SERVERS: 'true' }).ENABLE_CLAUDEAI_MCP_SERVERS).toBe('false');
  });
  it('秘密らしい変数は渡さないが、Claude Code 自身の認証と設定は残す', () => {
    const env = {
      PATH: '/bin',
      GITHUB_TOKEN: 'g',
      OPENAI_API_KEY: 'o',
      ANTHROPIC_API_KEY: 'a',
      CLAUDE_CODE_OAUTH_TOKEN: 't',
    };
    expect(claudeEnv(env)).toEqual({
      PATH: '/bin',
      ANTHROPIC_API_KEY: 'a',
      CLAUDE_CODE_OAUTH_TOKEN: 't',
      ENABLE_CLAUDEAI_MCP_SERVERS: 'false',
    });
  });

  it('クラウド事業者経由なら、その事業者の資格情報も残す', () => {
    const aws = { AWS_SECRET_ACCESS_KEY: 's', AWS_REGION: 'us-east-1' };
    expect(claudeEnv(aws)).toEqual({ AWS_REGION: 'us-east-1', ENABLE_CLAUDEAI_MCP_SERVERS: 'false' });
    expect(claudeEnv({ ...aws, CLAUDE_CODE_USE_BEDROCK: '1' })).toEqual({
      ...aws,
      CLAUDE_CODE_USE_BEDROCK: '1',
      ENABLE_CLAUDEAI_MCP_SERVERS: 'false',
    });
    expect(claudeEnv({ GOOGLE_APPLICATION_CREDENTIALS: '/k.json', CLAUDE_CODE_USE_VERTEX: '1' })).toHaveProperty(
      'GOOGLE_APPLICATION_CREDENTIALS',
    );
  });
});
