import { join } from 'node:path';
import { Codex, type CodexOptions } from '@openai/codex-sdk';
import { errorMessage } from '../log.ts';
import { codexError, EventReader } from './codex-runtime/events.ts';
import { CODEX_NOT_FOUND, findCodex } from './codex-runtime/executable.ts';
import { codexCatalog } from './codex-runtime/models.ts';
import {
  codexConfig,
  MAX_SYSTEM_PROMPT_LENGTH,
  threadInput,
  threadOptions,
  unenforceableReason,
} from './codex-runtime/options.ts';
import { withPathDirs } from './executables.ts';
import { writeSkills } from './skill-files.ts';
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

export async function runCodex(
  request: RunRequest,
  { signal, onActivity, onPost }: RunContext,
  provider = defaultProvider(),
): Promise<string> {
  rejectUnenforceable(provider.label, unenforceableReason(request.permissions));
  if (request.systemPrompt.length > MAX_SYSTEM_PROMPT_LENGTH) {
    throw new BackendError('bad_request', `Codex に渡すシステムプロンプトは ${MAX_SYSTEM_PROMPT_LENGTH} 文字までです`);
  }
  signal.throwIfAborted();
  const executable = findCodex();
  if (executable === null) throw new BackendError('internal', CODEX_NOT_FOUND);
  try {
    await writeSkills(join(request.workspace, '.agents', 'skills'), request.skills);
    const codex = new Codex({
      config: { ...provider.config, ...codexConfig(request) },
      codexPathOverride: executable.path,
      env: withPathDirs(executable.pathDirs, provider.env) ?? provider.env,
    });
    const thread = codex.startThread(threadOptions(request, provider.catalog));
    const { events } = await thread.runStreamed(threadInput(request), { signal });
    const reader = new EventReader(onActivity, onPost, provider.failure);
    for await (const event of events) reader.read(event);
    return reader.finalText;
  } catch (error) {
    if (error instanceof BackendError || signal.aborted) throw error;
    throw provider.failure(errorMessage(error));
  }
}
