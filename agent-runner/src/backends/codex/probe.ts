// Codex の状態の確認: Codex CLI が入っているか（executable.ts）と、認証の手段があるか。
// macOS は CLI に認証状態を問い合わせる（キーチェーンにも対応）。ほかの OS は資格情報の存在だけを見る。

import { homedir } from 'node:os';
import { join } from 'node:path';
import { definedEnv, fileExists } from '../environment.ts';
import type { BackendProbe } from '../types.ts';
import { codexNotFound, findCodex } from '../codex-runtime/executable.ts';
import { t } from '../codex-runtime/texts/index.ts';
import { CAN_LOGIN, hasCodexLogin } from './login.ts';
import { backendAuthMode } from '../auth-mode.ts';
import { apiKeyEnvironment } from '../../credentials/store.ts';

const CREDENTIAL_ENVS = ['OPENAI_API_KEY', 'CODEX_API_KEY'];

export async function probeCodex(): Promise<BackendProbe> {
  const executable = findCodex();
  if (executable === null) return { status: 'unavailable', statusMessage: codexNotFound() };
  if (backendAuthMode('codex') === 'api') {
    const env = await apiKeyEnvironment('codex', 'OPENAI_API_KEY');
    return env.OPENAI_API_KEY?.trim()
      ? { status: 'ready', statusMessage: '' }
      : { status: 'needs_auth', statusMessage: t('needsLoginTerminal') };
  }
  if (definedEnv(CREDENTIAL_ENVS.filter((name) => name !== 'OPENAI_API_KEY'))) return { status: 'ready', statusMessage: '' };
  const codexHome = process.env.CODEX_HOME || join(homedir(), '.codex');
  const signedIn = CAN_LOGIN ? await hasCodexLogin(executable) : await fileExists(join(codexHome, 'auth.json'));
  if (signedIn) return { status: 'ready', statusMessage: '' };
  return {
    status: 'needs_auth',
    statusMessage: CAN_LOGIN ? t('needsLogin') : t('needsLoginTerminal'),
  };
}
