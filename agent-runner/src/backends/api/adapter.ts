import { apiKeyEnvironment } from '../../credentials/store.ts';
import { BackendError, NO_SETUP, usableRequest, type BackendAdapter, type ModelCatalog } from '../types.ts';
import type { Codec } from './codec.ts';
import { runLoop } from './loop.ts';
import { t } from './texts.ts';

interface Provider {
  id: string;
  label: string;
  envVar: string;
  catalog: () => ModelCatalog;
  codec: Codec;
}
async function credential(provider: Provider): Promise<string> {
  try {
    // Only the selected credential leaves the store boundary. No shell or provider subprocess is created.
    const key = (await apiKeyEnvironment(provider.id, provider.envVar))[provider.envVar];
    if (!key?.trim()) throw new BackendError('auth', `${provider.label}: ${provider.envVar} is required.`);
    return key.trim();
  } catch {
    throw new BackendError('auth', t('auth', { name: provider.label, envVar: provider.envVar }));
  }
}
export function createApiAdapter(provider: Provider): BackendAdapter {
  const adapter: BackendAdapter = {
    info: () => ({
      id: provider.id,
      label: provider.label,
      capabilities: {
        webSearch: false,
        webFetch: true,
        readFiles: true,
        readAnywhere: true,
        writeFiles: false,
        writeAnywhere: false,
        runCommands: false,
        skills: true,
      },
      options: [],
      permissionRules: [{ when: 'readAnywhere', requires: ['readFiles'] }],
      leakRisks: [
        ['readFiles', 'webFetch'],
        ['readAnywhere', 'webFetch'],
      ],
      unrestricted: [],
      midRunPost: 'tool',
      toolsOption: null,
      local: false,
      frameGeneration: false,
      setup: { ...NO_SETUP, apiKey: { envVar: provider.envVar } },
    }),
    async probe() {
      try {
        await credential(provider);
        return {
          status: 'ready',
          statusMessage: t('ready', { name: provider.label }),
        };
      } catch {
        return {
          status: 'needs_auth',
          statusMessage: t('auth', { name: provider.label, envVar: provider.envVar }),
        };
      }
    },
    catalog: () => Promise.resolve(provider.catalog()),
    async run(original, context) {
      context.signal.throwIfAborted();
      const request = usableRequest(structuredClone(original), adapter.info());
      const catalog = provider.catalog();
      const model = request.model || catalog.defaultModel;
      const spec = catalog.models.find((spec) => spec.id === model);
      if (!spec) throw new BackendError('model_not_found', t('model', { name: provider.label }));
      const effort = request.options.effort ?? spec.defaultEffort;
      if (typeof effort !== 'string' || !spec.efforts.includes(effort))
        throw new BackendError('bad_request', t('effort', { name: provider.label }));
      if (request.images.length) throw new BackendError('bad_request', t('images', { name: provider.label }));
      const key = await credential(provider);
      context.signal.throwIfAborted();
      context.onSkillRead?.(null);
      const signal = AbortSignal.any([context.signal, AbortSignal.timeout(300000)]);
      return runLoop(provider.codec, request, key, model, effort, { ...context, signal });
    },
  };
  return adapter;
}
