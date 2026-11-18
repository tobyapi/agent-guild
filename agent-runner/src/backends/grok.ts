import { apiKeyEnvironment } from '../credentials/store.ts';
import {
  BackendError,
  NO_SETUP,
  usableRequest,
  type BackendAdapter,
  type BackendProbe,
  type ModelCatalog,
} from './types.ts';
import { client } from './grok/client.ts';
import { runLoop } from './grok/loop.ts';
import { tools, execute } from './grok/tools.ts';
import { t } from './grok/texts.ts';
import { input } from './grok/input.ts';

const API_KEY = { envVar: 'XAI_API_KEY' };
const MODEL = 'grok-4.7';

const catalog = (): ModelCatalog => ({
  defaultModel: MODEL,
  models: [{ id: MODEL, label: 'Grok 4.7', description: t('limits'), efforts: [], defaultEffort: null }],
});

async function credential(): Promise<string | undefined> {
  try {
    return (await apiKeyEnvironment('grok', API_KEY.envVar)).XAI_API_KEY;
  } catch {
    throw new BackendError('auth', 'Grok credential store is unavailable.');
  }
}

async function probe(): Promise<BackendProbe> {
  const key = await credential();
  return key?.trim()
    ? { status: 'ready', statusMessage: t('ready') }
    : { status: 'needs_auth', statusMessage: t('key') };
}

export const grokAdapter: BackendAdapter = {
  info: () => ({
    id: 'grok',
    label: 'Grok',
    capabilities: {
      webSearch: true,
      webFetch: true,
      readFiles: true,
      readAnywhere: true,
      writeFiles: false,
      writeAnywhere: false,
      runCommands: false,
      skills: true,
    },
    options: [],
    permissionRules: [
      { when: 'webSearch', requires: ['webFetch'] },
      { when: 'writeAnywhere', requires: ['writeFiles'] },
    ],
    leakRisks: [
      ['readFiles', 'webSearch'],
      ['readAnywhere', 'webSearch'],
      ['readFiles', 'webFetch'],
      ['readAnywhere', 'webFetch'],
    ],
    unrestricted: [],
    midRunPost: 'text',
    toolsOption: null,
    local: false,
    frameGeneration: false,
    setup: { ...NO_SETUP, apiKey: API_KEY },
  }),
  probe,
  catalog: () => Promise.resolve(catalog()),
  async run(original, context) {
    context.signal.throwIfAborted();
    context.onSkillRead?.(null);
    const request = usableRequest(structuredClone(original), grokAdapter.info());
    const key = await credential();
    if (!key?.trim()) throw new BackendError('auth', t('key'));
    const { signal } = context;
    signal.throwIfAborted();
    let lastPost = '';
    const posting = {
      ...context,
      onPost: (text: string) => {
        signal.throwIfAborted();
        lastPost = text;
        context.onPost(text);
      },
    };
    const result = await runLoop({
      model: request.model || MODEL,
      input: await input(request, signal),
      tools: () => tools(request),
      execute: (name, args, id) =>
        execute(
          request,
          { ...posting, onSkillRead: (skill) => context.onSkillRead?.(skill, `backend:${id}`) },
          name,
          args,
        ),
      send: client(key),
      context: posting,
    });
    return result.text.trim() === lastPost.trim() ? '' : result.text;
  },
};
