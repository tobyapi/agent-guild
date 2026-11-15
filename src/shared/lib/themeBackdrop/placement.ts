export type BackdropAnchor = 'left' | 'right' | 'bottomLeft' | 'bottomRight';
export interface PlacementRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const BACKDROP_VIEWBOX = Object.freeze([0, 0, 1000, 1000] as const);

export function anchorBounds(anchor: BackdropAnchor): PlacementRect {
  switch (anchor) {
    case 'left':
      return { x: 0, y: 0, width: 180, height: 1000 };
    case 'right':
      return { x: 820, y: 0, width: 180, height: 1000 };
    case 'bottomLeft':
      return { x: 0, y: 820, width: 180, height: 180 };
    case 'bottomRight':
      return { x: 820, y: 820, width: 180, height: 180 };
  }
}

// Mulberry32 uses explicit unsigned 32-bit arithmetic, including seed zero.
export function placementRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = Math.imul(state ^ (state >>> 15), state | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function placeLayer(anchor: BackdropAnchor, scale: number, random: () => number): PlacementRect {
  const bounds = anchorBounds(anchor);
  const size = 180 * scale;
  // Floor offsets to 0.001 viewBox units so serialization never rounds outside the frame.
  const offset = (space: number) => Math.floor(random() * space * 1000) / 1000;
  return {
    x: bounds.x + offset(bounds.width - size),
    y: bounds.y + offset(bounds.height - size),
    width: size,
    height: size,
  };
}
