// Muse Spark uses the existing Codex tool executor with a per-run Meta provider.
import { apiKeyEnvironment } from '../credentials/store.ts';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { withoutSecrets } from './agent-env.ts';
import { findCodex, codexNotFound } from './codex-runtime/executable.ts';
import { LEAK_RISKS, PERMISSION_RULES, UNRESTRICTED } from './codex-runtime/options.ts';
import { runCodex, type CodexProvider } from './codex-runtime.ts';
import { t } from './codex-runtime/texts/index.ts';
import {
  BackendError,
  NO_SETUP,
  classifyErrorText,
  type BackendAdapter,
  type BackendProbe,
  type ModelCatalog,
  type RunRequest,
} from './types.ts';

const MODEL = 'muse-spark-1.3';
const EFFORTS = ['minimal', 'low', 'medium', 'high', 'xhigh', 'max'];
const NAME = 'Muse Spark';

/** 画面に出る文字列は、呼んだ時点の言語で作る */
const catalog = (): ModelCatalog => ({
  defaultModel: MODEL,
  models: [
    {
      id: MODEL,
      label: t('experimental', { name: 'Muse Spark 1.3' }),
      description: t('providerModel', { search: t('webSearch') }),
      efforts: [...EFFORTS],
      defaultEffort: 'high',
    },
  ],
});

/** アプリに保存した API キーがなければ、この環境変数のキーを使う */
const API_KEY = { envVar: 'MODEL_API_KEY' };

async function probe(): Promise<BackendProbe> {
  if (findCodex() === null) return Promise.resolve({ status: 'unavailable', statusMessage: codexNotFound() });
  const env = await apiKeyEnvironment('muse', API_KEY.envVar);
  return Promise.resolve(
    env.MODEL_API_KEY?.trim()
      ? {
          status: 'ready',
          statusMessage: t('providerReady'),
        }
      : {
          status: 'needs_auth',
          statusMessage: t('providerNeedsKey', { envVar: API_KEY.envVar, name: NAME }),
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
  return new BackendError(code, t('providerFailed', { name: NAME }));
}

export function museProvider(stateDir: string, env: NodeJS.ProcessEnv = process.env): CodexProvider {
  if (!env.MODEL_API_KEY?.trim()) throw new BackendError('auth', t('providerKeyRequired', { envVar: API_KEY.envVar }));
  return {
    label: 'Muse Spark',
    catalog: catalog(),
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
  if (request.model && request.model !== MODEL) {
    throw new BackendError('model_not_found', t('providerModelOnly', { name: NAME, model: MODEL }));
  }
  if (request.permissions.webSearch) {
    throw new BackendError('unsupported_permission', t('providerNoWebSearch', { name: NAME, search: t('webSearch') }));
  }
  const effort = request.options.effort;
  if (effort !== undefined && (typeof effort !== 'string' || !EFFORTS.includes(effort))) {
    throw new BackendError('bad_request', t('providerEffort', { name: NAME, choices: EFFORTS.join(' / ') }));
  }
}

export const museAdapter: BackendAdapter = {
  info: () => ({
    id: 'muse',
    label: t('experimental', { name: NAME }),
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
    unrestricted: [...UNRESTRICTED],
    midRunPost: 'text',
    folderScope: 'sandbox',
    toolsOption: null,
    local: false,
    frameGeneration: false,
    setup: { ...NO_SETUP, apiKey: API_KEY },
  }),
  probe,
  catalog: () => Promise.resolve(catalog()),
  async run(request, context) {
    context.signal.throwIfAborted();
    validate(request);
    const provider = museProvider(request.stateDir, await apiKeyEnvironment('muse', API_KEY.envVar));
    await mkdir(provider.env.CODEX_HOME!, { recursive: true });
    return runCodex(request, context, provider);
  },
};
