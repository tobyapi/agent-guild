export type TypographyOptions = Record<string, string>;

const NUMBER = /^[+-]?(?:\d+(?:\.\d+)?|\.\d+)$/;
const COLORS = new Set(['red', 'black', 'white', 'blue', 'green', 'yellow', 'orange', 'purple', 'gray']);

export function boundedNumber(value: string | undefined, min: number, max: number): number | null {
  if (value === undefined || !NUMBER.test(value)) return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= min && number <= max ? number : null;
}

export function colorValue(value: string | undefined): string | null {
  if (!value) return null;
  const color = value.toLowerCase();
  return COLORS.has(color) || /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/.test(color) ? color : null;
}

export function numberList(value: string | undefined, min: number, max: number): number[] | null {
  if (!value) return null;
  const parts = value.trim().split(/\s+/);
  if (parts.length > 120) return null;
  const numbers = parts.map((part) => boundedNumber(part, min, max));
  return numbers.every((number) => number !== null) ? numbers.filter((number) => number !== null) : null;
}

export function textValues(options: TypographyOptions): TypographyOptions | null {
  const safe: TypographyOptions = {};
  for (const [key, value] of Object.entries(options)) {
    let result: string | null = null;
    if (key === 'color') result = colorValue(value);
    if (key === 'size') result = numberAsText(value, 0.5, 5);
    if (key === 'rotate') result = numberAsText(value, -360, 360);
    if (key === 'weight' && ['bold', 'normal'].includes(value)) result = value;
    if (result === null) return null;
    safe[key] = result;
  }
  return safe;
}

function numberAsText(value: string, min: number, max: number): string | null {
  const number = boundedNumber(value, min, max);
  return number === null ? null : String(number);
}

export function parseOptions(source: string, allowed: readonly string[]): TypographyOptions | null {
  const options: TypographyOptions = {};
  const attribute = /\s*([a-z]+)=(?:"([^"]*)"|([^\s"{}]+))/y;
  let offset = 0;
  while (offset < source.length) {
    if (source.slice(offset).trim() === '') break;
    attribute.lastIndex = offset;
    const match = attribute.exec(source);
    const key = match?.[1];
    if (!key || !allowed.includes(key) || Object.hasOwn(options, key)) return null;
    options[key] = match?.[2] ?? match?.[3] ?? '';
    offset = attribute.lastIndex;
  }
  return Object.keys(options).length > 0 ? options : null;
}

// SVG の各コマンドは引数の個数が違うため、この関数だけ分岐を一箇所に集める。
// eslint-disable-next-line complexity
function validPathCommands(parts: string[]): boolean {
  const widths: Record<string, number> = { m: 2, l: 2, h: 1, v: 1, c: 6, s: 4, q: 4, t: 2, a: 7, z: 0 };
  let command = '';
  let count = 0;
  let hasSegment = false;
  for (const part of parts) {
    if (/^[A-Za-z]$/.test(part)) {
      if (command && count === 0 && command !== 'z') return false;
      if (command && command !== 'z' && count % (widths[command] ?? 1) !== 0) return false;
      if (count > 0) hasSegment = true;
      command = part.toLowerCase();
      count = 0;
    } else {
      if (!command || command === 'z') return false;
      if (command === 'a' && [3, 4].includes(count % 7) && !['0', '1'].includes(part)) return false;
      count++;
    }
  }
  if (command === 'z') return hasSegment;
  return (hasSegment || count > 0) && count % (widths[command] ?? 1) === 0;
}

export function pathValue(value: string | undefined): string | null {
  if (!value || value.length > 300 || !/^[Mm]/.test(value)) return null;
  if (!/^[MmLlHhVvCcSsQqTtAaZz\d+.,\s-]+$/.test(value)) return null;
  const parts = value.match(/[A-Za-z]|[+-]?(?:\d+(?:\.\d+)?|\.\d+)/g);
  if (!parts || parts.join('').toLowerCase() !== value.replace(/[\s,]/g, '').toLowerCase()) return null;
  if (parts.some((part) => !/^[A-Za-z]$/.test(part) && boundedNumber(part, -1000, 1000) === null)) return null;
  return validPathCommands(parts) ? value : null;
}
