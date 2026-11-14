// Claude の状態の確認: Claude Code が入っているか（executable.ts）と、認証の手段があるか。
// macOS はキーチェーンも確認できるよう、認証状態を CLI に問い合わせる。

import { homedir } from 'node:os';
import { join } from 'node:path';
import { definedEnv, fileExists } from '../environment.ts';
import type { BackendProbe } from '../types.ts';
import { claudeNotFound, findClaude } from './executable.ts';
import { CAN_LOGIN, claudeLoginStatus } from './login.ts';
import { t } from './texts/index.ts';
import { backendAuthMode } from '../auth-mode.ts';
import { apiKeyEnvironment } from '../../credentials/store.ts';

/** どれかがあれば認証の手段があるとみなす（API キー・トークン・クラウド事業者経由） */
const CREDENTIAL_ENVS = [
  'ANTHROPIC_API_KEY',
  'ANTHROPIC_AUTH_TOKEN',
  'CLAUDE_CODE_OAUTH_TOKEN',
  'CLAUDE_CODE_USE_BEDROCK',
  'CLAUDE_CODE_USE_VERTEX',
  'CLAUDE_CODE_USE_FOUNDRY',
];

const READY: BackendProbe = { status: 'ready', statusMessage: '' };

export async function probeClaude(): Promise<BackendProbe> {
  const executable = findClaude();
  if (executable === null) return { status: 'unavailable', statusMessage: claudeNotFound() };
  if (backendAuthMode('claude') === 'api') {
    const env = await apiKeyEnvironment('claude', 'ANTHROPIC_API_KEY');
    return env.ANTHROPIC_API_KEY?.trim() ? READY : { status: 'needs_auth', statusMessage: t('needsLoginTerminal') };
  }
  if (definedEnv(CREDENTIAL_ENVS.filter((name) => name !== 'ANTHROPIC_API_KEY'))) return READY;
  if (process.platform === 'darwin') {
    const signedIn = await claudeLoginStatus(executable);
    if (signedIn === true) return READY;
    if (signedIn === null) return { status: 'ready', statusMessage: t('loginAtRun') };
  } else {
    const configDir = process.env.CLAUDE_CONFIG_DIR || join(homedir(), '.claude');
    if (await fileExists(join(configDir, '.credentials.json'))) return READY;
  }
  return {
    status: 'needs_auth',
    statusMessage: CAN_LOGIN ? t('needsLogin') : t('needsLoginTerminal'),
  };
}
