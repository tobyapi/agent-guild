import type { Rgb } from './envelope';

export interface Rgba {
  rgb: Rgb;
  alpha: number;
}

export interface ColorSource {
  file: string;
  line: number;
  expression: string;
}
export type ColorDefinitions = Readonly<Record<string, ColorSource>>;

/** Resolve only the finite sRGB grammar used by the static inventory; unknown CSS stays unresolved. */
export function resolveTokenColor(
  expression: string,
  definitions: ColorDefinitions,
  trail: string[] = [],
): Rgba | null {
  const value = expression.trim();
  if (value.startsWith('var(') && value.endsWith(')')) {
    const [name, ...fallback] = splitArguments(value.slice(4, -1));
    if (!name || trail.includes(name)) return null;
    const definition = definitions[name];
    const next = definition?.expression ?? fallback.join(',');
    return next ? resolveTokenColor(next, definitions, [...trail, name]) : null;
  }
  if (value === 'transparent') return { rgb: [0, 0, 0], alpha: 0 };
  if (value.startsWith('#')) return resolveHex(value);
  if (value.startsWith('rgb')) return resolveRgb(value);
  return resolveMix(value, definitions, trail);
}

function resolveHex(value: string): Rgba | null {
  const hex = /^#([0-9a-f]{6})([0-9a-f]{2})?$/i.exec(value);
  if (hex)
    return {
      rgb: [0, 2, 4].map((i) => parseInt(hex[1]!.slice(i, i + 2), 16) / 255) as [number, number, number],
      alpha: hex[2] ? parseInt(hex[2], 16) / 255 : 1,
    };
  return null;
}

function resolveRgb(value: string): Rgba | null {
  const rgba = /^rgba?\(([^)]+)\)$/.exec(value);
  if (rgba) {
    const parts = rgba[1]!.split(',').map(Number);
    if (![3, 4].includes(parts.length) || parts.some((v) => !Number.isFinite(v))) return null;
    const result: Rgba = { rgb: [parts[0]! / 255, parts[1]! / 255, parts[2]! / 255], alpha: parts[3] ?? 1 };
    return [...result.rgb, result.alpha].every((v) => v >= 0 && v <= 1) ? result : null;
  }
  return null;
}

function resolveMix(value: string, definitions: ColorDefinitions, trail: string[]): Rgba | null {
  if (!value.startsWith('color-mix(in srgb,') || !value.endsWith(')')) return null;
  const parts = splitArguments(value.slice(10, -1));
  const firstPart = /^(.*)\s+(var\(--[\w-]+\)|[\d.]+%)$/.exec(parts[1] ?? '');
  if (!firstPart || !parts[2]) return null;
  const first = resolveTokenColor(firstPart[1]!, definitions, trail);
  const second = resolveTokenColor(parts[2], definitions, trail);
  const weightExpression = firstPart[2]!.replace(
    /var\((--[\w-]+)\)/,
    (_, name: string) => definitions[name]?.expression ?? '',
  );
  const weight = Number(weightExpression.replace('%', '')) / 100;
  if (!first || !second || !Number.isFinite(weight) || weight < 0 || weight > 1) return null;
  const alpha = first.alpha * weight + second.alpha * (1 - weight);
  return {
    rgb: [0, 1, 2].map((i) =>
      alpha ? (first.rgb[i]! * first.alpha * weight + second.rgb[i]! * second.alpha * (1 - weight)) / alpha : 0,
    ) as [number, number, number],
    alpha,
  };
}

export function compositeColor(top: Rgba, bottom: Rgba): Rgba {
  const alpha = top.alpha + bottom.alpha * (1 - top.alpha);
  return {
    rgb: [0, 1, 2].map((i) =>
      alpha ? (top.rgb[i]! * top.alpha + bottom.rgb[i]! * bottom.alpha * (1 - top.alpha)) / alpha : 0,
    ) as [number, number, number],
    alpha,
  };
}

function splitArguments(value: string): string[] {
  let depth = 0;
  let start = 0;
  const parts: string[] = [];
  for (let i = 0; i < value.length; i++) {
    if (value[i] === '(') depth++;
    if (value[i] === ')') depth--;
    if (value[i] === ',' && depth === 0) {
      parts.push(value.slice(start, i).trim());
      start = i + 1;
    }
  }
  return [...parts, value.slice(start).trim()];
}
