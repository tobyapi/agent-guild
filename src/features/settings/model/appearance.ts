import { unifyAppearance } from '@/shared/theme/catalog';
import { defaultAppearance, hasThemeVariants } from '@/shared/theme/registry';
import { resolveBackground } from '@/shared/theme/backgrounds';
import type { AppearancePreference, ThemeRegistry } from '@/shared/theme/types';
import { ACCENTS } from './accent';

export const APPEARANCE_STORAGE_KEY = 'agent-guild.appearance.v1';
const SCHEMES = ['dark', 'light', 'system'];

export class AppearanceValidationError extends Error {}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function parseAppearance(stored: string, registry: ThemeRegistry): AppearancePreference {
  const value: unknown = JSON.parse(stored);
  if (!isRecord(value) || value.version !== 1) throw new AppearanceValidationError('unsupported appearance version');
  if (typeof value.themeId !== 'string' || !hasThemeVariants(registry, value.themeId)) {
    throw new AppearanceValidationError('unknown theme or missing variants');
  }
  if (typeof value.schemePreference !== 'string' || !SCHEMES.includes(value.schemePreference)) {
    throw new AppearanceValidationError('invalid scheme preference');
  }
  if (value.accentOverride !== null && !ACCENTS.some((id) => id !== 'default' && id === value.accentOverride)) {
    throw new AppearanceValidationError('invalid accent override');
  }
  if (value.motionPreference !== 'system' && value.motionPreference !== 'off') {
    throw new AppearanceValidationError('invalid motion preference');
  }
  const background = parseBackground(value.backgroundOverride);
  return unifyAppearance({
    version: 1,
    themeId: value.themeId,
    schemePreference: value.schemePreference as AppearancePreference['schemePreference'],
    accentOverride: value.accentOverride as AppearancePreference['accentOverride'],
    backgroundOverride: background,
    motionPreference: value.motionPreference,
  });
}

function parseBackground(value: unknown): AppearancePreference['backgroundOverride'] {
  if (value === null) return null;
  if (!isRecord(value)) throw new AppearanceValidationError('invalid background override');
  if (value.kind === 'none') return { kind: 'none' };
  if (value.kind === 'image' && typeof value.assetId === 'string')
    return resolveBackground({ kind: 'image', assetId: value.assetId });
  if (value.kind === 'scene' && typeof value.sceneId === 'string')
    return resolveBackground({ kind: 'scene', sceneId: value.sceneId });
  if (value.kind === 'generated' && typeof value.presetId === 'string')
    return resolveBackground({ kind: 'generated', presetId: value.presetId });
  throw new AppearanceValidationError('invalid background kind');
}

export function migrateAppearance(theme: string | null, accent: string | null): AppearancePreference {
  if ((theme !== null && !SCHEMES.includes(theme)) || (accent !== null && !ACCENTS.some((id) => id === accent))) {
    throw new AppearanceValidationError('invalid legacy appearance');
  }
  return {
    ...defaultAppearance(),
    schemePreference: (theme ?? 'dark') as AppearancePreference['schemePreference'],
    accentOverride: accent === null || accent === 'default' ? null : (accent as AppearancePreference['accentOverride']),
  };
}
