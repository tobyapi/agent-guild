import type { Scheme } from './types';

export const THEME_SCHEMA_VERSION = 2;

type Divider =
  | { color: string; style: 'solid' | 'dashed'; width: 1 | 2 | 3 }
  | { color: string; style: 'double'; width: 3 }
  | { color: string; style: 'none'; width: 0 };

export interface Palette {
  surface: string;
  text: string;
  muted: string;
  accent: string;
  divider?: Divider;
}
interface StyleOptions {
  name: string;
  corners: 'square' | 'standard' | 'soft';
  typeStyle: 'system' | 'serifHeadings';
}
interface DividerStyle extends StyleOptions {
  schemaVersion: typeof THEME_SCHEMA_VERSION;
  variants: Record<Scheme, Palette & { divider: Divider }>;
}
export type ThemeStyle =
  (StyleOptions & { schemaVersion: 1; variants: Record<Scheme, Palette & { divider?: never }> }) | DividerStyle;
export interface ThemeCandidate extends DividerStyle {
  background: { kind: 'generate'; description: string };
}
export type SavedTheme = ThemeStyle & {
  id: string;
  backgroundId: string | null;
};

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
const colorKeys = ['surface', 'text', 'muted', 'accent'];
const isHex = (value: unknown) => typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value);

function isDivider(value: unknown): value is Divider {
  if (!hasKeys(value, ['color', 'style', 'width']) || !isHex(value.color)) return false;
  switch (value.style) {
    case 'none':
      return value.width === 0;
    case 'double':
      return value.width === 3;
    case 'solid':
    case 'dashed':
      return value.width === 1 || value.width === 2 || value.width === 3;
    default:
      return false;
  }
}

function isPalette(value: unknown, requireDivider: boolean): value is Palette {
  const keys = requireDivider ? [...colorKeys, 'divider'] : colorKeys;
  return (
    hasKeys(value, keys) && colorKeys.every((key) => isHex(value[key])) && (!requireDivider || isDivider(value.divider))
  );
}
function isStyle(value: Record<string, unknown>, version: ThemeStyle['schemaVersion']): boolean {
  const requireDivider = version === THEME_SCHEMA_VERSION;
  return (
    value.schemaVersion === version &&
    shortText(value.name, 40) &&
    hasKeys(value.variants, ['dark', 'light']) &&
    isPalette(value.variants.dark, requireDivider) &&
    isPalette(value.variants.light, requireDivider) &&
    typeof value.corners === 'string' &&
    ['square', 'standard', 'soft'].includes(value.corners) &&
    (value.typeStyle === 'system' || value.typeStyle === 'serifHeadings')
  );
}
export function parseCandidate(raw: string): ThemeCandidate {
  if (raw.length > 8192) throw new Error('schema');
  const value: unknown = JSON.parse(raw);
  if (
    !hasKeys(value, [...styleKeys, 'background']) ||
    !isStyle(value, THEME_SCHEMA_VERSION) ||
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
    (isStyle(value, 1) || isStyle(value, THEME_SCHEMA_VERSION)) &&
    typeof value.id === 'string' &&
    value.id.startsWith('user-') &&
    uuidPattern.test(value.id.slice(5)) &&
    (value.backgroundId === null || (typeof value.backgroundId === 'string' && uuidPattern.test(value.backgroundId)))
  );
}
