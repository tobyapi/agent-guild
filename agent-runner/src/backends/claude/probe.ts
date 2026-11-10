// Claude の状態の確認: Claude Code が入っているか（executable.ts）と、認証の手段があるか。
// macOS はキーチェーンも確認できるよう、認証状態を CLI に問い合わせる。

import { homedir } from 'node:os';
import { join } from 'node:path';
import { definedEnv, fileExists } from '../environment.ts';
import type { BackendProbe } from '../types.ts';
import { CLAUDE_NOT_FOUND, findClaude } from './executable.ts';
import { CAN_LOGIN, claudeLoginStatus } from './login.ts';

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
  if (executable === null) return { status: 'unavailable', statusMessage: CLAUDE_NOT_FOUND };
  if (definedEnv(CREDENTIAL_ENVS)) return READY;
  if (process.platform === 'darwin') {
    const signedIn = await claudeLoginStatus(executable);
    if (signedIn === true) return READY;
    if (signedIn === null) return { status: 'ready', statusMessage: 'ログイン状態は実行時に確認します' };
  } else {
    const configDir = process.env.CLAUDE_CONFIG_DIR || join(homedir(), '.claude');
    if (await fileExists(join(configDir, '.credentials.json'))) return READY;
  }
  return {
    status: 'needs_auth',
    statusMessage: CAN_LOGIN
      ? 'Claude を使うには、ブラウザーで Claude のアカウントにログインしてください。'
      : 'Claude にログインしていません。ターミナルで `claude auth login` を実行するか、環境変数 ANTHROPIC_API_KEY を設定してください。',
  };
}
