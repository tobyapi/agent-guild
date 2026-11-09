// Claude の認証状態の確認。環境変数と資格情報ファイルの「存在」だけを見る（中身は読まない）。

import { homedir } from 'node:os';
import { join } from 'node:path';
import { definedEnv, fileExists } from '../environment.ts';
import type { BackendProbe } from '../types.ts';
import { CAN_LOGIN } from './login.ts';

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
  if (definedEnv(CREDENTIAL_ENVS)) return READY;
  const configDir = process.env.CLAUDE_CONFIG_DIR || join(homedir(), '.claude');
  if (await fileExists(join(configDir, '.credentials.json'))) return READY;
  // macOS ではログイン情報がキーチェーンにあり、ファイルの有無では分からない
  if (process.platform === 'darwin') return { status: 'ready', statusMessage: 'ログイン状態は実行時に確認します' };
  return {
    status: 'needs_auth',
    statusMessage: CAN_LOGIN
      ? 'Claude にログインしていません。［ログイン］を押して、開いたブラウザで Claude のアカウントにログインしてください（API キーを使うなら環境変数 ANTHROPIC_API_KEY を設定します）。'
      : 'Claude にログインしていません。ターミナルで `claude auth login` を実行するか、環境変数 ANTHROPIC_API_KEY を設定してください。',
  };
}
