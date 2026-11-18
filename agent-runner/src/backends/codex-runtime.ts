import { Codex, type CodexOptions, type ThreadOptions } from '@openai/codex-sdk';
import { errorMessage } from '../log.ts';
import { codexError, EventReader } from './codex-runtime/events.ts';
import { codexNotFound, findCodex } from './codex-runtime/executable.ts';
import { codexCatalog } from './codex-runtime/models.ts';
import { installCodexSkills } from './codex-runtime/skills.ts';
import { t } from './codex-runtime/texts/index.ts';
import {
  codexConfig,
  MAX_SYSTEM_PROMPT_LENGTH,
  threadInput,
  threadOptions,
  unenforceableReason,
} from './codex-runtime/options.ts';
import { withPathDirs } from './executables.ts';
import { codexAuthEnvironment } from './auth-mode.ts';
import { prepareCommandSandbox } from './command-sandbox.ts';
import { BackendError, rejectUnenforceable, type ModelCatalog, type RunContext, type RunRequest } from './types.ts';

export interface CodexProvider {
  label: string;
  config: NonNullable<CodexOptions['config']>;
  env: Record<string, string>;
  catalog: ModelCatalog;
  failure: (detail: string) => BackendError;
}

function defaultProvider(): CodexProvider {
  const env = Object.fromEntries(
    Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined),
  );
  return { label: 'Codex', config: {}, catalog: codexCatalog(), env, failure: codexError };
}

async function requireWindowsSandbox(mode: ThreadOptions['sandboxMode']): Promise<void> {
  if (process.platform !== 'win32' || mode !== 'workspace-write') return;
  if (!(await prepareCommandSandbox())) {
    throw new BackendError('unsupported_permission', 'この PC では OS の隔離を使えません');
  }
}

export async function runCodex(
  request: RunRequest,
  { signal, onActivity, onPost, onUsage }: RunContext,
  provider = defaultProvider(),
): Promise<string> {
  try {
    provider = { ...provider, env: await codexAuthEnvironment(provider.env) };
  } catch {
    throw new BackendError('auth', t('needsLoginTerminal'));
  }
  rejectUnenforceable(provider.label, unenforceableReason(request.permissions));
  if (request.systemPrompt.length > MAX_SYSTEM_PROMPT_LENGTH) {
    throw new BackendError('bad_request', t('systemPromptTooLong', { max: MAX_SYSTEM_PROMPT_LENGTH }));
  }
  signal.throwIfAborted();
  const executable = findCodex();
  if (executable === null) throw new BackendError('internal', codexNotFound());
  const options = threadOptions(request, provider.catalog);
  await requireWindowsSandbox(options.sandboxMode);
  signal.throwIfAborted();
  try {
    await installCodexSkills(request.workspace, request.skills);
    signal.throwIfAborted();
    const codex = new Codex({
      config: { ...provider.config, ...codexConfig(request) },
      codexPathOverride: executable.path,
      env: withPathDirs(executable.pathDirs, provider.env) ?? provider.env,
    });
    if (options.model) onUsage({ model: options.model });
    const thread = codex.startThread(options);
    const { events } = await thread.runStreamed(threadInput(request), { signal });
    const reader = new EventReader(onActivity, onPost, provider.failure, onUsage);
    for await (const event of events) reader.read(event);
    return reader.finalText;
  } catch (error) {
    if (error instanceof BackendError || signal.aborted) throw error;
    throw provider.failure(errorMessage(error));
  }
}
