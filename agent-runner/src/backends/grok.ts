// Grok uses the existing Codex tool executor with a per-run xAI provider.
import { apiKeyEnvironment } from '../credentials/store.ts';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { withoutSecrets } from './agent-env.ts';
import { findCodex, CODEX_NOT_FOUND } from './codex-runtime/executable.ts';
import { LEAK_RISKS, PERMISSION_RULES } from './codex-runtime/options.ts';
import { runCodex, type CodexProvider } from './codex-runtime.ts';
import { BackendError, classifyErrorText, type BackendAdapter, type BackendProbe, type ModelCatalog, type RunRequest } from './types.ts';

const CATALOG: ModelCatalog = {
  defaultModel: 'grok-4.7',
  models: [{
    id: 'grok-4.7', label: 'Grok 4.7（実験対応・実API未検証）',
    description: 'Codex SDK経由。Web検索・X検索は未対応。API利用料が発生する。',
    efforts: ['low', 'medium', 'high', 'xhigh'], defaultEffort: 'high',
  }],
};

async function probe(): Promise<BackendProbe> {
  if (findCodex() === null) return Promise.resolve({ status: 'unavailable', statusMessage: CODEX_NOT_FOUND });
  const env = await apiKeyEnvironment('grok');
  return Promise.resolve(env.XAI_API_KEY?.trim()
    ? { status: 'ready', statusMessage: '実験対応・実API未検証。readyはAPIキーとCLIの存在確認のみで、接続成功を意味しない。' }
    : { status: 'needs_auth', statusMessage: '設定 → バックエンドでAPIキーを保存するか、環境変数 XAI_API_KEY を設定してアプリを再起動してください。GrokのWebログインは使えません。' });
}

// Provider failures may contain headers or credentials. Never publish their raw text.
function failure(detail: string): BackendError {
  return new BackendError(classifyErrorText(detail), 'Grokの実行に失敗した。APIキー・利用枠・モデル名・接続を確認してください。');
}

export function grokProvider(stateDir: string, env: NodeJS.ProcessEnv = process.env): CodexProvider {
  if (!env.XAI_API_KEY?.trim()) throw new BackendError('auth', '環境変数 XAI_API_KEY が必要です。');
  return {
    label: 'Grok', catalog: CATALOG, failure,
    env: { ...withoutSecrets(env, (name) => name === 'XAI_API_KEY'), CODEX_HOME: join(stateDir, 'codex') },
    config: {
      model_provider: 'guild_xai',
      model_providers: { guild_xai: {
        name: 'Grok', base_url: 'https://api.x.ai/v1', env_key: 'XAI_API_KEY',
        wire_api: 'responses', requires_openai_auth: false, supports_websockets: false,
      } },
      model_reasoning_summary: 'none',
      features: { multi_agent: false },
    },
  };
}

function validate(request: RunRequest): void {
  if (request.permissions.webSearch) {
    throw new BackendError('unsupported_permission', 'GrokのWeb検索・X検索は未対応です。Web検索を無効にしてください。');
  }
  const effort = request.options.effort;
  if (effort !== undefined && (typeof effort !== 'string' || !['low', 'medium', 'high', 'xhigh'].includes(effort))) {
    throw new BackendError('bad_request', 'Grokの推論の深さは low / medium / high / xhigh から選んでください。');
  }
}

export const grokAdapter: BackendAdapter = {
  info: () => ({
    id: 'grok', label: 'Grok（実験対応・実API未検証）',
    capabilities: { webSearch: false, webFetch: true, readFiles: true, writeFiles: true, writeAnywhere: true, runCommands: true, skills: true },
    options: [], permissionRules: [...PERMISSION_RULES], leakRisks: LEAK_RISKS.map((risk) => [...risk]),
    canLogin: false, midRunPost: 'text',
  }),
  probe,
  catalog: () => Promise.resolve(structuredClone(CATALOG)),
  async run(request, context) {
    context.signal.throwIfAborted();
    validate(request);
    const provider = grokProvider(request.stateDir, await apiKeyEnvironment('grok'));
    await mkdir(provider.env.CODEX_HOME!, { recursive: true });
    return runCodex(request, context, provider);
  },
};
