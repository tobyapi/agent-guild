import type { RunUsage } from '../../protocol.ts';
import { object } from './json.ts';

function count(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : undefined;
}
export function usage(
  value: unknown,
  model: string,
  input: string,
  output: string,
  thoughts?: string,
): RunUsage | undefined {
  if (!object(value)) return;
  const inputTokens = count(value[input]);
  const tokens = count(value[output]);
  const reasoning = thoughts ? (count(value[thoughts]) ?? 0) : 0;
  if (inputTokens === undefined || tokens === undefined) return;
  return { model, inputTokens, outputTokens: tokens + reasoning };
}
