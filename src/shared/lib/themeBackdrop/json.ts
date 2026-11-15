import { reject } from './checks';

// Scan before JSON.parse discards duplicate keys. Only JSON grammar is accepted.
export function parseRecipeJson(input: string): unknown {
  if (new TextEncoder().encode(input).length > 32768) reject('$', 'input_too_large');
  const reader = new JsonGate(input);
  reader.value(0);
  reader.space();
  if (reader.position !== input.length) reject('$', 'invalid_json');
  return JSON.parse(input) as unknown;
}

class JsonGate {
  position = 0;
  constructor(private readonly input: string) {}

  space(): void {
    while (/[\x20\t\r\n]/.test(this.input[this.position] ?? 'x')) this.position++;
  }

  value(depth: number): void {
    this.space();
    const token = this.input[this.position];
    if (token === '{' || token === '[') {
      if (depth + 1 > 8) reject('$', 'nesting_too_deep');
      this.container(token, depth + 1);
    } else if (token === '"') {
      this.string();
    } else {
      this.scalar();
    }
  }

  private container(open: string, depth: number): void {
    this.position++;
    const close = open === '{' ? '}' : ']';
    const keys = new Set<string>();
    this.space();
    if (this.input[this.position] === close) {
      this.position++;
      return;
    }
    while (true) {
      if (open === '{') {
        this.space();
        const key = this.string();
        if (keys.has(key)) reject('$', 'duplicate_key');
        keys.add(key);
        this.space();
        if (this.input[this.position++] !== ':') reject('$', 'invalid_json');
      }
      this.value(depth);
      this.space();
      const next = this.input[this.position++];
      if (next === close) return;
      if (next !== ',') reject('$', 'invalid_json');
    }
  }

  private string(): string {
    const start = this.position;
    if (this.input[this.position++] !== '"') reject('$', 'invalid_json');
    while (this.position < this.input.length) {
      const char = this.input[this.position++];
      if (char === '\\') this.position++;
      if (char === '"') {
        try {
          const result = JSON.parse(this.input.slice(start, this.position)) as string;
          // serde_json rejects unpaired UTF-16 surrogates.
          if (/[\uD800-\uDFFF]/u.test(result)) reject('$', 'invalid_json');
          return result;
        } catch {
          reject('$', 'invalid_json');
        }
      }
    }
    return reject('$', 'invalid_json');
  }

  private scalar(): void {
    const match = /^(?:true|false|null|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)/.exec(
      this.input.slice(this.position),
    );
    if (!match) reject('$', 'invalid_json');
    if (!['true', 'false', 'null'].includes(match[0]) && !Number.isFinite(Number(match[0])))
      reject('$', 'invalid_json');
    this.position += match[0].length;
  }
}
