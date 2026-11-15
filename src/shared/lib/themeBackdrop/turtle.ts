import type { LayerExpansion } from './cost';
import type { BackdropLayer } from './skeleton';

// '.' is transparent; digits are fixed roles mapped to validated palette indices.
export const TURTLE_GRID = Object.freeze([
  '................',
  '................',
  '.....11.........',
  '....1221........',
  '...122221.......',
  '..12233221......',
  '..12322321..11..',
  '.11232232211221.',
  '..1232232212231.',
  '..12233221..11..',
  '...122221.......',
  '....1221........',
  '.....11.........',
  '................',
  '................',
  '................',
] as const);

export interface TurtlePixelRect {
  x: number;
  y: number;
  width: number;
  height: number;
  color: number;
}
export interface TurtleArtwork {
  rectangles: TurtlePixelRect[];
  expansion: LayerExpansion;
  usesBlackShadow: false;
}

export function buildTurtleArtwork(layer: BackdropLayer, paletteLength: number): TurtleArtwork {
  const roles = [0, layer.color, (layer.color % (paletteLength - 1)) + 1, 1];
  const repeats = 1 + Math.round(layer.density);
  const rectangles: TurtlePixelRect[] = [];
  for (let tileY = 0; tileY < repeats; tileY++) {
    for (let tileX = 0; tileX < repeats; tileX++) {
      TURTLE_GRID.forEach((row, y) => {
        for (let x = 0; x < row.length;) {
          const role = row[x]!;
          let end = x + 1;
          while (end < row.length && row[end] === role) end++;
          if (role !== '.') {
            rectangles.push({
              x: (tileX + x / 16) / repeats,
              y: (tileY + y / 16) / repeats,
              width: (end - x) / (16 * repeats),
              height: 1 / (16 * repeats),
              color: roles[Number(role)]!,
            });
          }
          x = end;
        }
      });
    }
  }
  return {
    rectangles,
    expansion: {
      cost: { primitives: rectangles.length, dom: rectangles.length, definitions: 0, movingGroups: 0 },
      patterns: [],
    },
    usesBlackShadow: false,
  };
}
