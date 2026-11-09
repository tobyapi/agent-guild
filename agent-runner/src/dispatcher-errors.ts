import { BackendError } from './backends/types.ts';
import { errorMessage, logError } from './log.ts';
import type { RunnerEvent } from './protocol.ts';

export function toErrorEvent(id: string, error: unknown): RunnerEvent {
  if (error instanceof BackendError) return { type: 'error', id, code: error.code, message: error.message };
  logError(`ジョブ ${id} で予期しないエラーが起きました`, error);
  return { type: 'error', id, code: 'internal', message: errorMessage(error) };
}
