import { invalid, object } from '../api/json.ts';
import type { Call } from '../api/tools.ts';

export function append(raw: unknown): string {
  if (raw === undefined || raw === null) return '';
  if (typeof raw !== 'string') throw invalid();
  return raw;
}
function update(value: Record<string, unknown>, call: Call): void {
  if (value.type !== undefined && value.type !== 'function') throw invalid();
  if (value.id !== undefined) {
    if (typeof value.id !== 'string' || call.id) throw invalid();
    call.id = value.id;
  }
  if (value.function !== undefined) {
    if (!object(value.function)) throw invalid();
    call.name += append(value.function.name);
    call.args += append(value.function.arguments);
  }
  if (call.args.length > 32768 || call.name.length > 128 || call.id.length > 256) throw invalid();
}
export function addCalls(raw: unknown, calls: Map<number, Call>): void {
  if (raw === undefined) return;
  if (!Array.isArray(raw) || raw.length > 20) throw invalid();
  for (const value of raw) {
    if (!object(value) || typeof value.index !== 'number' || !Number.isInteger(value.index)) throw invalid();
    if (value.index < 0 || value.index >= 20) throw invalid();
    const call = calls.get(value.index) ?? { id: '', name: '', args: '' };
    update(value, call);
    calls.set(value.index, call);
  }
}
