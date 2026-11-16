import { BackendError } from '../types.ts';

export type Item = Record<string, unknown>;
export interface Response {
  id: string;
  status: string;
  output: Item[];
  usage: Item;
}

export const invalid = (): BackendError =>
  new BackendError('internal', 'Grok returned an invalid or incomplete response.');
export function object(value: unknown): value is Item {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function response(value: unknown): Response {
  if (
    !object(value) ||
    typeof value.id !== 'string' ||
    value.status !== 'completed' ||
    !Array.isArray(value.output) ||
    !value.output.every(object) ||
    !object(value.usage)
  )
    throw invalid();
  return { id: value.id, status: value.status, output: value.output, usage: value.usage };
}

export function finalText(output: Item[]): string {
  const text: string[] = [];
  for (const item of output) {
    if (item.type !== 'message' || !Array.isArray(item.content)) continue;
    const content: unknown[] = item.content;
    for (const part of content) {
      if (object(part) && part.type === 'output_text' && typeof part.text === 'string') text.push(part.text);
    }
  }
  return text.join('\n');
}
