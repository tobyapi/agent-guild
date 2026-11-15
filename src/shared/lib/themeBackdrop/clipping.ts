import { reject } from './checks';
import type { PlacementRect } from './placement';

export interface BackdropGeometry {
  viewport: readonly [number, number];
  textProtection?: readonly PlacementRect[];
  clipId?: string;
}
export interface BackdropClip {
  tag: 'clipPath';
  id: string;
  clipPathUnits: 'userSpaceOnUse';
  rectangles: PlacementRect[];
}
export const QUIET_CENTER: Readonly<PlacementRect> = Object.freeze({ x: 240, y: 80, width: 520, height: 840 });

export function buildBackdropClip(geometry: BackdropGeometry): BackdropClip {
  if (geometry.viewport.length !== 2 || geometry.viewport.some((v) => !Number.isFinite(v) || v <= 0)) {
    reject('$', 'invalid_expansion');
  }
  const id = geometry.clipId ?? 'backdrop-protection';
  if (!/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(id)) reject('$', 'invalid_expansion');
  const protection = geometry.textProtection ?? [];
  if (protection.length > 32) reject('$', 'invalid_expansion');
  let rectangles: PlacementRect[] = [{ x: 0, y: 0, width: 1000, height: 1000 }];
  for (const hole of [QUIET_CENTER, ...protection]) {
    if (
      [hole.x, hole.y, hole.width, hole.height].some((v) => !Number.isFinite(v)) ||
      hole.width <= 0 ||
      hole.height <= 0
    ) {
      reject('$', 'invalid_expansion');
    }
    rectangles = rectangles.flatMap((rect) => subtractRect(rect, hole));
  }
  return { tag: 'clipPath', id, clipPathUnits: 'userSpaceOnUse', rectangles };
}

function subtractRect(rect: PlacementRect, hole: PlacementRect): PlacementRect[] {
  const left = Math.max(rect.x, hole.x);
  const top = Math.max(rect.y, hole.y);
  const right = Math.min(rect.x + rect.width, hole.x + hole.width);
  const bottom = Math.min(rect.y + rect.height, hole.y + hole.height);
  if (left >= right || top >= bottom) return [rect];
  return [
    { x: rect.x, y: rect.y, width: rect.width, height: top - rect.y },
    { x: rect.x, y: bottom, width: rect.width, height: rect.y + rect.height - bottom },
    { x: rect.x, y: top, width: left - rect.x, height: bottom - top },
    { x: right, y: top, width: rect.x + rect.width - right, height: bottom - top },
  ].filter((part) => part.width > 0 && part.height > 0);
}
