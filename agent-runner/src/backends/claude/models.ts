// Claude で選べるモデルと推論の深さ。利用者の環境の Claude Code に聞く（supportedModels。プロンプトは送らない）。
// 聞けなければ、Claude Code の別名（opus・sonnet・haiku）だけを出す。深さを選ばなければ Claude Code の既定に任せる
// （settingSources: [] なので、利用者の Claude Code の設定の深さは使われない）。

import { query, type ModelInfo, type SDKUserMessage } from '@anthropic-ai/claude-agent-sdk';
import { errorMessage, logInfo } from '../../log.ts';
import type { ModelSpec } from '../../protocol.ts';
import type { ModelCatalog } from '../types.ts';
import { findClaude } from './executable.ts';
import { CLAUDE_EFFORTS, DEFAULT_MODEL } from './options.ts';

/** 一覧を聞くのを待つ上限（ready はこれを待ってから送る。Rust が ready を待つ 20 秒より十分短く） */
const LIST_TIMEOUT_MS = 8_000;

/** 聞けなかったときの一覧（Claude Code の別名） */
export const FALLBACK_MODELS: readonly ModelSpec[] = [
  { id: 'opus', label: 'Opus', description: '', efforts: [...CLAUDE_EFFORTS], defaultEffort: null },
  { id: 'sonnet', label: 'Sonnet', description: '', efforts: [...CLAUDE_EFFORTS], defaultEffort: null },
  { id: 'haiku', label: 'Haiku', description: '', efforts: [...CLAUDE_EFFORTS], defaultEffort: null },
];

export async function claudeCatalog(): Promise<ModelCatalog> {
  const executable = findClaude();
  const models = executable === null ? FALLBACK_MODELS : await listModels(executable);
  return { models: [...models], defaultModel: DEFAULT_MODEL };
}

/** Claude Code の一覧（「default」は除く。アプリの既定は defaultModel で決める）。聞けなければ FALLBACK_MODELS */
export function toModelSpecs(models: readonly ModelInfo[]): ModelSpec[] {
  return models
    .filter((model) => model.value !== 'default')
    .map((model) => ({
      id: model.value,
      label: model.displayName,
      description: model.description,
      efforts: model.supportedEffortLevels ? [...model.supportedEffortLevels] : [],
      defaultEffort: null,
    }));
}

async function listModels(executable: string): Promise<readonly ModelSpec[]> {
  const abortController = new AbortController();
  const timer = setTimeout(() => abortController.abort(), LIST_TIMEOUT_MS);
  try {
    const session = query({
      prompt: idle(abortController.signal),
      options: { pathToClaudeCodeExecutable: executable, settingSources: [], persistSession: false, abortController },
    });
    const models = toModelSpecs(await session.supportedModels());
    return models.length > 0 ? models : FALLBACK_MODELS;
  } catch (error) {
    logInfo(`[claude] モデルの一覧を聞けませんでした（${errorMessage(error)}）`);
    return FALLBACK_MODELS;
  } finally {
    clearTimeout(timer);
    abortController.abort();
  }
}

/** 何も送らずに待つ入力（abort で終わる） */
function idle(signal: AbortSignal): AsyncIterable<SDKUserMessage> {
  const done = new Promise<IteratorResult<SDKUserMessage>>((resolve) => {
    signal.addEventListener('abort', () => resolve({ done: true, value: undefined }), { once: true });
  });
  return { [Symbol.asyncIterator]: () => ({ next: () => done }) };
}
