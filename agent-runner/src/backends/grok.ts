// Grok uses the existing Codex tool executor with a per-run xAI provider.
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

const MODEL = 'grok-4.7';
const EFFORTS = ['low', 'medium', 'high', 'xhigh'];

/** 画面に出る文字列は、呼んだ時点の言語で作る */
const catalog = (): ModelCatalog => ({
  defaultModel: MODEL,
  models: [
    {
      id: MODEL,
      label: t('experimental', { name: 'Grok 4.7' }),
      description: t('providerModel', { search: t('webAndXSearch') }),
      efforts: [...EFFORTS],
      defaultEffort: 'high',
    },
  ],
});

/** アプリに保存した API キーがなければ、この環境変数のキーを使う */
const API_KEY = { envVar: 'XAI_API_KEY' };

async function probe(): Promise<BackendProbe> {
  if (findCodex() === null) return Promise.resolve({ status: 'unavailable', statusMessage: codexNotFound() });
  const env = await apiKeyEnvironment('grok', API_KEY.envVar);
  return Promise.resolve(
    env.XAI_API_KEY?.trim()
      ? {
          status: 'ready',
          statusMessage: t('providerReady'),
        }
      : {
          status: 'needs_auth',
          statusMessage: t('providerNeedsKey', { envVar: API_KEY.envVar, name: 'Grok' }),
        },
  );
}

// Provider failures may contain headers or credentials. Never publish their raw text.
function failure(detail: string): BackendError {
  return new BackendError(classifyErrorText(detail), t('providerFailed', { name: 'Grok' }));
}

export function grokProvider(stateDir: string, env: NodeJS.ProcessEnv = process.env): CodexProvider {
  if (!env.XAI_API_KEY?.trim()) throw new BackendError('auth', t('providerKeyRequired', { envVar: API_KEY.envVar }));
  return {
    label: 'Grok',
    catalog: catalog(),
    failure,
    env: { ...withoutSecrets(env, (name) => name === 'XAI_API_KEY'), CODEX_HOME: join(stateDir, 'codex') },
    config: {
      model_provider: 'guild_xai',
      model_providers: {
        guild_xai: {
          name: 'Grok',
          base_url: 'https://api.x.ai/v1',
          env_key: 'XAI_API_KEY',
          wire_api: 'responses',
          requires_openai_auth: false,
          supports_websockets: false,
        },
      },
      model_reasoning_summary: 'none',
      features: { multi_agent: false },
    },
  };
}

function validate(request: RunRequest): void {
  if (request.permissions.webSearch) {
    throw new BackendError(
      'unsupported_permission',
      t('providerNoWebSearch', { name: 'Grok', search: t('webAndXSearch') }),
    );
  }
  const effort = request.options.effort;
  if (effort !== undefined && (typeof effort !== 'string' || !EFFORTS.includes(effort))) {
    throw new BackendError('bad_request', t('providerEffort', { name: 'Grok', choices: EFFORTS.join(' / ') }));
  }
}

export const grokAdapter: BackendAdapter = {
  info: () => ({
    id: 'grok',
    label: t('experimental', { name: 'Grok' }),
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
    setup: { ...NO_SETUP, apiKey: API_KEY },
  }),
  probe,
  catalog: () => Promise.resolve(catalog()),
  async run(request, context) {
    context.signal.throwIfAborted();
    validate(request);
    const provider = grokProvider(request.stateDir, await apiKeyEnvironment('grok', API_KEY.envVar));
    await mkdir(provider.env.CODEX_HOME!, { recursive: true });
    return runCodex(request, context, provider);
  },
};
