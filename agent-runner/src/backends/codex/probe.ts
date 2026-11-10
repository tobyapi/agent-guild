// Codex の状態の確認: Codex CLI が入っているか（executable.ts）と、認証の手段があるか。
// macOS は CLI に認証状態を問い合わせる（キーチェーンにも対応）。ほかの OS は資格情報の存在だけを見る。

import { homedir } from 'node:os';
import { join } from 'node:path';
import { definedEnv, fileExists } from '../environment.ts';
import type { BackendProbe } from '../types.ts';
import { CODEX_NOT_FOUND, findCodex } from '../codex-runtime/executable.ts';
import { CAN_LOGIN, hasCodexLogin } from './login.ts';

const CREDENTIAL_ENVS = ['OPENAI_API_KEY', 'CODEX_API_KEY'];

export async function probeCodex(): Promise<BackendProbe> {
  const executable = findCodex();
  if (executable === null) return { status: 'unavailable', statusMessage: CODEX_NOT_FOUND };
  if (definedEnv(CREDENTIAL_ENVS)) return { status: 'ready', statusMessage: '' };
  const codexHome = process.env.CODEX_HOME || join(homedir(), '.codex');
  const signedIn = CAN_LOGIN ? await hasCodexLogin(executable) : await fileExists(join(codexHome, 'auth.json'));
  if (signedIn) return { status: 'ready', statusMessage: '' };
  return {
    status: 'needs_auth',
    statusMessage: CAN_LOGIN
      ? 'Codex を使うには、ChatGPT アカウントでログインしてください。'
      : 'ターミナルで `codex login` を実行するか、環境変数 OPENAI_API_KEY を設定してください。',
  };
}
