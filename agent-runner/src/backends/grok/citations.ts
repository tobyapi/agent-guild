import { object, type Item } from './response.ts';
import { controls } from './characters.ts';

function url(value: unknown): string | null {
  if (typeof value !== 'string' || controls(value, true)) return null;
  try {
    const parsed = new URL(value);
    return ['http:', 'https:'].includes(parsed.protocol) && !parsed.username && !parsed.password ? parsed.href : null;
  } catch {
    return null;
  }
}

/** Sources with missing/zero positions are appended; never splice untrusted indices into text. */
export function citations(output: Item[]): string[] {
  const found = new Set<string>();
  const inspect = (value: unknown): void => {
    if (!object(value)) return;
    const candidate = url(value.url);
    if (candidate) found.add(candidate);
  };
  for (const item of output) {
    if (object(item.action) && Array.isArray(item.action.sources)) item.action.sources.forEach(inspect);
    if (Array.isArray(item.content))
      for (const content of item.content) {
        if (object(content) && Array.isArray(content.annotations)) content.annotations.forEach(inspect);
      }
    if (Array.isArray(item.citations)) item.citations.forEach(inspect);
  }
  return [...found];
}
