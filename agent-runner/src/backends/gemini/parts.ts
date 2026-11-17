import { randomUUID } from 'node:crypto';
import { blocked, invalid, object, truncated, type Item } from '../api/json.ts';
import type { Call } from '../api/tools.ts';

function call(part: Item, fallback: string): Call | undefined {
  if (part.functionCall === undefined) return;
  const value = part.functionCall;
  if (!object(value) || typeof value.name !== 'string' || !object(value.args)) throw invalid();
  if (value.id !== undefined && typeof value.id !== 'string') throw invalid();
  return {
    id: typeof value.id === 'string' ? value.id : fallback,
    wireId: typeof value.id === 'string' ? value.id : undefined,
    name: value.name,
    args: JSON.stringify(value.args),
  };
}
function partsOf(candidate: Item): Item[] {
  if (candidate.content === undefined) return [];
  if (
    !object(candidate.content) ||
    candidate.content.role !== 'model' ||
    !Array.isArray(candidate.content.parts) ||
    !candidate.content.parts.every(object)
  )
    throw invalid();
  return candidate.content.parts;
}
export class State {
  parts: Item[] = [];
  calls: Call[] = [];
  text = '';
  finished = false;
  rawUsage: unknown;
  #turn = randomUUID();
  add(event: Item): void {
    if (event.error) throw invalid();
    if (object(event.promptFeedback) && event.promptFeedback.blockReason) throw blocked();
    this.rawUsage = event.usageMetadata ?? this.rawUsage;
    if (event.candidates === undefined) return;
    if (!Array.isArray(event.candidates) || event.candidates.length > 1) throw invalid();
    for (const candidate of event.candidates) this.candidate(candidate);
  }
  candidate(candidate: unknown): void {
    if (!object(candidate) || (candidate.index !== undefined && candidate.index !== 0) || this.finished)
      throw invalid();
    for (const part of partsOf(candidate)) this.part(part);
    if (candidate.finishReason !== undefined) {
      if (candidate.finishReason === 'MAX_TOKENS') throw truncated();
      if (
        [
          'SAFETY',
          'RECITATION',
          'LANGUAGE',
          'BLOCKLIST',
          'PROHIBITED_CONTENT',
          'SPII',
          'IMAGE_SAFETY',
          'IMAGE_PROHIBITED_CONTENT',
        ].includes(String(candidate.finishReason))
      )
        throw blocked();
      if (candidate.finishReason !== 'STOP') throw invalid();
      this.finished = true;
    }
  }
  part(part: Item): void {
    if (part.thoughtSignature !== undefined && typeof part.thoughtSignature !== 'string') throw invalid();
    const invocation = call(part, `${this.#turn}:${this.calls.length}`);
    if (invocation) this.invocation(invocation);
    if (part.text !== undefined) {
      if (typeof part.text !== 'string') throw invalid();
      if (part.thought !== true) this.text += part.text;
    }
    if (part.text === undefined && !invocation && !part.thoughtSignature) throw invalid();
    // Preserve opaque parts/signatures in their original positions; never publish thoughts.
    this.parts.push(part);
  }
  invocation(invocation: Call): void {
    if (this.calls.length >= 20) throw invalid();
    this.calls.push(invocation);
  }
}
