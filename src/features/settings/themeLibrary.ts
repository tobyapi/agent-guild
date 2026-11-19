import { isSavedTheme, THEME_SCHEMA_VERSION, type SavedTheme } from '@/shared/theme/candidate';
import { checkTheme } from '@/shared/theme/checkTheme';
import { defaultAppearance, safeAppearance } from '@/shared/theme/registry';
import type { AppearancePreference, ThemeRegistry } from '@/shared/theme/types';
import type { AppearancePersistence } from './appearancePersistence';
import { parseAppearance } from './model/appearance';

export const LIBRARY_KEY = 'agent-guild.appearance.v3';
export interface ThemeLibrary {
  themes: SavedTheme[];
  active: AppearancePreference;
  previous: AppearancePreference | null;
}
export function emptyLibrary(): ThemeLibrary {
  return { themes: [], active: defaultAppearance(), previous: null };
}

export function libraryRegistry(base: ThemeRegistry, themes: SavedTheme[]): ThemeRegistry {
  const registry = { ...base };
  for (const theme of themes) {
    const background = theme.backgroundId
      ? { kind: 'image' as const, assetId: theme.backgroundId }
      : { kind: 'none' as const };
    registry[theme.id] = { schemaVersion: 1, id: theme.id, variants: { dark: { background }, light: { background } } };
  }
  return registry;
}
function readPreference(value: unknown, registry: ThemeRegistry, themes: SavedTheme[]): AppearancePreference | null {
  try {
    const pref = parseAppearance(JSON.stringify(value), registry);
    const theme = themes.find((t) => t.id === pref.themeId);
    if (theme && checkTheme(theme, pref.accentOverride).length) return { ...pref, accentOverride: null };
    return pref;
  } catch {
    return null;
  }
}
function isFuture(value: unknown) {
  return (
    !!value &&
    typeof value === 'object' &&
    'schemaVersion' in value &&
    typeof value.schemaVersion === 'number' &&
    value.schemaVersion > THEME_SCHEMA_VERSION
  );
}
function verifiedThemes(values: unknown[]) {
  const themes: SavedTheme[] = [];
  for (const t of values) {
    if (isSavedTheme(t) && !themes.some((other) => other.id === t.id) && !checkTheme(t).length) themes.push(t);
  }
  return themes;
}
function decodeLibrary(raw: string, base: ThemeRegistry) {
  const data: unknown = JSON.parse(raw);
  if (!data || typeof data !== 'object' || !('version' in data)) throw new Error('version');
  if (typeof data.version === 'number' && data.version > 3)
    return { library: { ...emptyLibrary(), active: safeAppearance() }, readOnly: true };
  if (data.version !== 3 || !('themes' in data) || !Array.isArray(data.themes)) throw new Error('themes');
  const themes = verifiedThemes(data.themes);
  const registry = libraryRegistry(base, themes);
  const active = readPreference('active' in data ? data.active : null, registry, themes) ?? safeAppearance();
  const previous = readPreference('previous' in data ? data.previous : null, registry, themes);
  return { library: { themes, active, previous }, readOnly: data.themes.some(isFuture) };
}
export function loadLibrary(io: AppearancePersistence, base: ThemeRegistry) {
  const safe = { ...emptyLibrary(), active: safeAppearance() };
  try {
    const storage = io.storage();
    const raw = storage.getItem(LIBRARY_KEY);
    if (raw === null) {
      const library = emptyLibrary();
      try {
        storage.setItem(LIBRARY_KEY, JSON.stringify({ version: 3, ...library }));
      } catch {
        io.warn(LIBRARY_KEY + ' could not be saved');
      }
      return { library, readOnly: false };
    }
    return decodeLibrary(raw, base);
  } catch {
    io.warn(LIBRARY_KEY + ' could not be loaded');
    return { library: safe, readOnly: false };
  }
}
export function switchTheme(library: ThemeLibrary, id: string): ThemeLibrary {
  if (id === library.active.themeId) return library;
  if (id !== 'guild' && !library.themes.some((t) => t.id === id)) throw new Error('theme');
  return {
    ...library,
    previous: library.active,
    active: { ...library.active, themeId: id, backgroundOverride: null, accentOverride: null },
  };
}
export function removeTheme(library: ThemeLibrary, id: string): ThemeLibrary {
  if (!library.themes.some((t) => t.id === id)) return library;
  const themes = library.themes.filter((t) => t.id !== id);
  const previous = library.previous?.themeId === id ? null : library.previous;
  if (library.active.themeId !== id) return { ...library, themes, previous };
  const fallback = switchTheme(library, 'guild').active;
  return { ...library, themes, active: previous ?? fallback, previous: null };
}
