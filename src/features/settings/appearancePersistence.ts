import { hasThemeVariants, safeAppearance } from '@/shared/theme/registry';
import type { AppearancePreference, ThemeRegistry } from '@/shared/theme/types';
import {
  APPEARANCE_STORAGE_KEY,
  LEGACY_APPEARANCE_STORAGE_KEY,
  AppearanceValidationError,
  migrateAppearance,
  parseAppearance,
} from './model/appearance';
import { ACCENT_STORAGE_KEY } from './model/accent';
import { THEME_STORAGE_KEY } from './model/theme';

export interface AppearancePersistence {
  storage: () => Pick<Storage, 'getItem' | 'setItem'>;
  warn: (message: string) => void;
}

export function loadAppearance(io: AppearancePersistence, registry: ThemeRegistry): AppearancePreference {
  let key = APPEARANCE_STORAGE_KEY;
  try {
    const storage = io.storage();
    const stored = storage.getItem(key);
    if (stored !== null) {
      const preference = parseAppearance(stored, registry);
      if (JSON.stringify(preference) !== stored) saveAppearance(io, preference);
      return preference;
    }
    key = LEGACY_APPEARANCE_STORAGE_KEY;
    const legacy = storage.getItem(key);
    if (legacy !== null) {
      const migrated = parseAppearance(legacy, registry);
      saveAppearance(io, migrated);
      return migrated;
    }
    key = THEME_STORAGE_KEY;
    const theme = storage.getItem(key);
    key = ACCENT_STORAGE_KEY;
    const accent = storage.getItem(key);
    if (!hasThemeVariants(registry, 'guild')) throw new AppearanceValidationError('missing guild variants');
    const migrated = migrateAppearance(theme, accent);
    saveAppearance(io, migrated);
    return migrated;
  } catch (error) {
    const reason = recoveryReason(error);
    io.warn(`${key}: ${reason}; restoring guild/system`);
    const safe = safeAppearance();
    saveAppearance(io, safe);
    return safe;
  }
}

function recoveryReason(error: unknown): string {
  if (error instanceof AppearanceValidationError) return error.message;
  if (error instanceof SyntaxError) return 'malformed JSON';
  return 'storage unavailable';
}

export function saveAppearance(io: AppearancePersistence, preference: AppearancePreference): void {
  // Old keys remain untouched so rollback keeps the old appearance.
  try {
    io.storage().setItem(APPEARANCE_STORAGE_KEY, JSON.stringify(preference));
  } catch {
    io.warn(`${APPEARANCE_STORAGE_KEY}: save failed; keeping appearance in memory`);
  }
}
