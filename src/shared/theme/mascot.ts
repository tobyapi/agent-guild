import { isImageAvatar } from '@/shared/lib/avatar';
import { isBackgroundAssetId } from './backgrounds';

export type MascotSource =
  | { kind: 'default' }
  | { kind: 'agent'; id: string }
  | { kind: 'preset'; avatar: string; fullBody?: true }
  | { kind: 'generated'; id: string };

export interface MascotPlacement {
  /** 0–100 along the available travel within the scene. */
  x: number;
  y: number;
  /** Percentage of the base size. */
  size: number;
}

export interface MascotLayout {
  mascot: MascotPlacement;
  card: MascotPlacement;
}

export interface MascotSettings {
  enabled: boolean;
  source: MascotSource;
  layout: MascotLayout;
}

export const MASCOT_SIZE_MIN = 70;
export const MASCOT_SIZE_MAX = 130;
export const MASCOT_PRESET_MAX_LENGTH = 400_000;
export const DEFAULT_MASCOT_AVATAR = '🦉';
export const DEFAULT_MASCOT_LAYOUT: MascotLayout = {
  mascot: { x: 98, y: 97, size: 100 },
  card: { x: 99, y: 1, size: 100 },
};

export const DEFAULT_MASCOT_SETTINGS: MascotSettings = {
  enabled: true,
  source: { kind: 'default' },
  layout: DEFAULT_MASCOT_LAYOUT,
};

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

export function mascotPercent(value: number): number {
  return Math.min(100, Math.max(0, Math.round(value)));
}

function bounded(value: unknown, fallback: number, min: number, max: number): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(max, Math.max(min, Math.round(value)))
    : fallback;
}

function readPlacement(value: unknown, fallback: MascotPlacement): MascotPlacement {
  const fields = record(value);
  return {
    x: bounded(fields.x, fallback.x, 0, 100),
    y: bounded(fields.y, fallback.y, 0, 100),
    size: bounded(fields.size, fallback.size, MASCOT_SIZE_MIN, MASCOT_SIZE_MAX),
  };
}

function readSource(value: unknown): MascotSource {
  const { kind, id, avatar, fullBody } = record(value);
  if (
    kind === 'preset' &&
    typeof avatar === 'string' &&
    avatar.length <= MASCOT_PRESET_MAX_LENGTH &&
    isImageAvatar(avatar)
  )
    return fullBody === true ? { kind, avatar, fullBody } : { kind, avatar };
  if (typeof id === 'string' && id && id.length <= 128) {
    if (kind === 'agent') return { kind, id };
    if (kind === 'generated' && isBackgroundAssetId(id)) return { kind, id };
  }
  return DEFAULT_MASCOT_SETTINGS.source;
}

export function readMascotSettings(value: unknown): MascotSettings {
  if (value === undefined) return DEFAULT_MASCOT_SETTINGS;
  const { enabled, source, layout } = record(value);
  const placements = record(layout);
  return {
    enabled: typeof enabled === 'boolean' ? enabled : DEFAULT_MASCOT_SETTINGS.enabled,
    source: readSource(source),
    layout: {
      mascot: readPlacement(placements.mascot, DEFAULT_MASCOT_LAYOUT.mascot),
      card: readPlacement(placements.card, DEFAULT_MASCOT_LAYOUT.card),
    },
  };
}
