// Muse Spark uses the existing Codex tool executor with a per-run Meta provider.
import { apiKeyEnvironment } from '../credentials/store.ts';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { withoutSecrets } from './agent-env.ts';
import { findCodex, CODEX_NOT_FOUND } from './codex-runtime/executable.ts';
import { LEAK_RISKS, PERMISSION_RULES } from './codex-runtime/options.ts';
import { runCodex, type CodexProvider } from './codex-runtime.ts';
import {
  BackendError,
  classifyErrorText,
  type BackendAdapter,
  type BackendProbe,
  type ModelCatalog,
  type RunRequest,
} from './types.ts';

const CATALOG: ModelCatalog = {
  defaultModel: 'muse-spark-1.3',
  models: [
    {
      id: 'muse-spark-1.3',
      label: 'Muse Spark 1.3（実験対応・実API未検証）',
      description: 'Codex SDK経由。Web検索は未対応。API利用料が発生する。',
      efforts: ['minimal', 'low', 'medium', 'high', 'xhigh', 'max'],
      defaultEffort: 'high',
    },
  ],
};

async function probe(): Promise<BackendProbe> {
  if (findCodex() === null) return Promise.resolve({ status: 'unavailable', statusMessage: CODEX_NOT_FOUND });
  const env = await apiKeyEnvironment('muse');
  return Promise.resolve(
    env.MODEL_API_KEY?.trim()
      ? {
          status: 'ready',
          statusMessage: '実験対応・実API未検証。readyはAPIキーとCLIの存在確認のみで、接続成功を意味しない。',
        }
      : {
          status: 'needs_auth',
          statusMessage:
            '設定 → バックエンドでAPIキーを保存するか、環境変数 MODEL_API_KEY を設定してアプリを再起動してください。Muse SparkのWebログインは使えません。',
        },
  );
}

// Provider failures may contain headers or credentials. Never publish their raw text.
function failure(detail: string): BackendError {
  const code = /\binvalid_api_key\b/.test(detail)
    ? 'auth'
    : /\bmodel_not_found\b/.test(detail)
      ? 'model_not_found'
      : classifyErrorText(detail);
  return new BackendError(code, 'Muse Sparkの実行に失敗した。APIキー・利用枠・モデル名・接続を確認してください。');
}

export function museProvider(stateDir: string, env: NodeJS.ProcessEnv = process.env): CodexProvider {
  if (!env.MODEL_API_KEY?.trim()) throw new BackendError('auth', '環境変数 MODEL_API_KEY が必要です。');
  return {
    label: 'Muse Spark',
    catalog: CATALOG,
    failure,
    env: { ...withoutSecrets(env, (name) => name === 'MODEL_API_KEY'), CODEX_HOME: join(stateDir, 'muse-codex') },
    config: {
      model_provider: 'guild_meta',
      model_providers: {
        guild_meta: {
          name: 'Muse Spark',
          base_url: 'https://api.meta.ai/v1',
          env_key: 'MODEL_API_KEY',
          wire_api: 'responses',
          requires_openai_auth: false,
          supports_websockets: false,
        },
      },
      features: { multi_agent: false },
      model_reasoning_summary: 'auto',
      model_context_window: 1_048_576,
      model_auto_compact_token_limit: 900_000,
    },
  };
}

function validate(request: RunRequest): void {
  // Keep training-contributor variants out of the agent's model selection.
  if (request.model && request.model !== CATALOG.defaultModel) {
    throw new BackendError('model_not_found', 'Muse Sparkでは muse-spark-1.3 を選択してください。');
  }
  if (request.permissions.webSearch) {
    throw new BackendError('unsupported_permission', 'Muse SparkのWeb検索は未対応です。Web検索を無効にしてください。');
  }
  const effort = request.options.effort;
  if (
    effort !== undefined &&
    (typeof effort !== 'string' || !['minimal', 'low', 'medium', 'high', 'xhigh', 'max'].includes(effort))
  ) {
    throw new BackendError(
      'bad_request',
      'Muse Sparkの推論の深さは minimal / low / medium / high / xhigh / max から選んでください。',
    );
  }
}

export const museAdapter: BackendAdapter = {
  info: () => ({
    id: 'muse',
    label: 'Muse Spark（実験対応・実API未検証）',
    capabilities: {
      webSearch: false,
      webFetch: true,
      readFiles: true,
      readAnywhere: false,
      writeFiles: true,
      writeAnywhere: true,
      runCommands: true,
      skills: true,
    },
    options: [],
    permissionRules: [...PERMISSION_RULES],
    leakRisks: LEAK_RISKS.map((risk) => [...risk]),
    canLogin: false,
    midRunPost: 'text',
  }),
  probe,
  catalog: () => Promise.resolve(structuredClone(CATALOG)),
  async run(request, context) {
    context.signal.throwIfAborted();
    validate(request);
    const provider = museProvider(request.stateDir, await apiKeyEnvironment('muse'));
    await mkdir(provider.env.CODEX_HOME!, { recursive: true });
    return runCodex(request, context, provider);
  },
};
