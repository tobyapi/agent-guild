// Codex の状態の確認: Codex CLI が入っているか（executable.ts）と、認証の手段があるか。
// 認証は環境変数と資格情報ファイルの「存在」だけを見る（中身は読まない）。

import { homedir } from 'node:os';
import { join } from 'node:path';
import { definedEnv, fileExists } from '../environment.ts';
import type { BackendProbe } from '../types.ts';
import { CODEX_NOT_FOUND, findCodex } from './executable.ts';

const CREDENTIAL_ENVS = ['OPENAI_API_KEY', 'CODEX_API_KEY'];

export async function probeCodex(): Promise<BackendProbe> {
  if (findCodex() === null) return { status: 'unavailable', statusMessage: CODEX_NOT_FOUND };
  if (definedEnv(CREDENTIAL_ENVS)) return { status: 'ready', statusMessage: '' };
  const codexHome = process.env.CODEX_HOME || join(homedir(), '.codex');
  if (await fileExists(join(codexHome, 'auth.json'))) return { status: 'ready', statusMessage: '' };
  return {
    status: 'needs_auth',
    statusMessage: 'Codex にログインしていません。ターミナルで `codex login` を実行するか、環境変数 OPENAI_API_KEY を設定してください。',
  };
}
