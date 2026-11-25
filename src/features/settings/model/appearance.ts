import { hasThemeVariants } from '@/shared/theme/registry';
import { resolveBackground } from '@/shared/theme/backgrounds';
import type { AppearancePreference, ThemeRegistry } from '@/shared/theme/types';
import { ACCENTS } from './accent';

const SCHEMES = ['dark', 'light', 'system'];

export class AppearanceValidationError extends Error {}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function parseAppearance(stored: string, registry: ThemeRegistry): AppearancePreference {
  const value: unknown = JSON.parse(stored);
  if (!isRecord(value) || value.version !== 2) throw new AppearanceValidationError('unsupported appearance version');
  validateFields(value, registry);
  const background = parseBackground(value.backgroundOverride);
  return {
    version: 2,
    themeId: value.themeId,
    schemePreference: value.schemePreference,
    accentOverride: value.accentOverride,
    backgroundOverride: value.themeId === 'guild' ? (background ?? { kind: 'none' }) : background,
  };
}

function validateFields(
  value: Record<string, unknown>,
  registry: ThemeRegistry,
): asserts value is Record<string, unknown> &
  Pick<AppearancePreference, 'themeId' | 'schemePreference' | 'accentOverride'> {
  if (typeof value.themeId !== 'string' || !hasThemeVariants(registry, value.themeId)) {
    throw new AppearanceValidationError('unknown theme or missing variants');
  }
  if (typeof value.schemePreference !== 'string' || !SCHEMES.includes(value.schemePreference)) {
    throw new AppearanceValidationError('invalid scheme preference');
  }
  if (value.accentOverride !== null && !ACCENTS.some((id) => id !== 'default' && id === value.accentOverride)) {
    throw new AppearanceValidationError('invalid accent override');
  }
}

function parseBackground(value: unknown): AppearancePreference['backgroundOverride'] {
  if (value === null) return null;
  if (!isRecord(value)) throw new AppearanceValidationError('invalid background override');
  if (value.kind === 'none' || value.kind === 'mascot') return { kind: value.kind };
  if (value.kind === 'image' && typeof value.assetId === 'string')
    return resolveBackground({ kind: 'image', assetId: value.assetId });
  if (
    (value.kind === 'scene' && typeof value.sceneId === 'string') ||
    (value.kind === 'generated' && typeof value.presetId === 'string')
  )
    return { kind: 'none' };
  throw new AppearanceValidationError('invalid background kind');
}
