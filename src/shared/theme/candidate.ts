import type { Scheme } from './types';

export interface Palette {
  surface: string;
  text: string;
  muted: string;
  accent: string;
}
export interface ThemeStyle {
  schemaVersion: 1;
  name: string;
  variants: Record<Scheme, Palette>;
  corners: 'square' | 'standard' | 'soft';
  typeStyle: 'system' | 'serifHeadings';
}
export interface ThemeCandidate extends ThemeStyle {
  background: { kind: 'generate'; description: string };
}
export interface SavedTheme extends ThemeStyle {
  id: string;
  backgroundId: string | null;
}

const styleKeys = ['schemaVersion', 'name', 'variants', 'corners', 'typeStyle'];
export function hasKeys(value: unknown, keys: string[]): value is Record<string, unknown> {
  return (
    !!value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.keys(value).length === keys.length &&
    keys.every((key) => Object.hasOwn(value, key))
  );
}
export function shortText(value: unknown, limit: number): value is string {
  return typeof value === 'string' && !!value.trim() && Array.from(value.trim()).length <= limit;
}
function isPalette(value: unknown): value is Palette {
  return (
    hasKeys(value, ['surface', 'text', 'muted', 'accent']) &&
    Object.values(value).every((color) => typeof color === 'string' && /^#[0-9a-f]{6}$/i.test(color))
  );
}
function isStyle(value: Record<string, unknown>): boolean {
  return (
    value.schemaVersion === 1 &&
    shortText(value.name, 40) &&
    hasKeys(value.variants, ['dark', 'light']) &&
    isPalette(value.variants.dark) &&
    isPalette(value.variants.light) &&
    ['square', 'standard', 'soft'].includes(String(value.corners)) &&
    typeof value.corners === 'string' &&
    (value.typeStyle === 'system' || value.typeStyle === 'serifHeadings')
  );
}
export function parseCandidate(raw: string): ThemeCandidate {
  if (raw.length > 8192) throw new Error('schema');
  const value: unknown = JSON.parse(raw);
  if (
    !hasKeys(value, [...styleKeys, 'background']) ||
    !isStyle(value) ||
    !hasKeys(value.background, ['kind', 'description']) ||
    value.background.kind !== 'generate' ||
    !shortText(value.background.description, 200)
  )
    throw new Error('schema');
  return value as unknown as ThemeCandidate;
}
export const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
export function isSavedTheme(value: unknown): value is SavedTheme {
  return (
    hasKeys(value, [...styleKeys, 'id', 'backgroundId']) &&
    isStyle(value) &&
    typeof value.id === 'string' &&
    value.id.startsWith('user-') &&
    uuidPattern.test(value.id.slice(5)) &&
    (value.backgroundId === null || (typeof value.backgroundId === 'string' && uuidPattern.test(value.backgroundId)))
  );
}
