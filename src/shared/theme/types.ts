export type Scheme = 'dark' | 'light';
export type SchemePreference = Scheme | 'system';
export const ACCENT_IDS = ['vermilion', 'sakura', 'green', 'sky', 'violet', 'silver'] as const;
export type AccentId = (typeof ACCENT_IDS)[number];
export type MotionPreference = 'system' | 'off';

export type BackgroundSpec =
  | { readonly kind: 'none' }
  | { readonly kind: 'image'; readonly assetId: string }
  | { readonly kind: 'scene'; readonly sceneId: string };

export interface AppearancePreference {
  readonly version: 1;
  readonly themeId: string;
  readonly schemePreference: SchemePreference;
  readonly accentOverride: AccentId | null;
  readonly backgroundOverride: BackgroundSpec | null;
  readonly motionPreference: MotionPreference;
}

export interface ThemeDefinition {
  readonly schemaVersion: 1;
  readonly id: string;
  readonly variants: Readonly<Record<Scheme, { readonly background: BackgroundSpec }>>;
}

export type ThemeRegistry = Readonly<Record<string, ThemeDefinition>>;

export interface ResolvedAppearance {
  readonly themeId: string;
  readonly scheme: Scheme;
  readonly accentOverride: AccentId | null;
  readonly backgroundOverride: BackgroundSpec;
  readonly motion: MotionPreference;
}
