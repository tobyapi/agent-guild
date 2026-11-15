import type { LayerExpansion } from './cost';
import type { BackdropLayer } from './skeleton';

// '.' is transparent; digits are fixed roles mapped to validated palette indices.
export const TURTLE_GRID = Object.freeze([
  '................',
  '.......11.......',
  '......1221......',
  '......1221......',
  '..11.111111.11..',
  '.12211233211221.',
  '..111233332111..',
  '...1233113321...',
  '...1231221321...',
  '...1231221321...',
  '...1233113321...',
  '..111233332111..',
  '.12211233211221.',
  '..11.111111.11..',
  '.......11.......',
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
  layout: { columns: number; rows: number; spriteSize: number; cellWidth: number; cellHeight: number };
}

export function buildTurtleArtwork(
  layer: BackdropLayer,
  paletteLength: number,
  size: readonly [number, number],
): TurtleArtwork {
  const roles = [0, layer.color, (layer.color % (paletteLength - 1)) + 1, 1];
  const [width, height] = size;
  // Scale controls the sprite; density controls its spacing across the entire anchor.
  const desiredSize = 180 * layer.scale;
  const pitch = desiredSize * (2 - layer.density);
  const columns = Math.max(1, Math.ceil(width / pitch));
  const rows = Math.max(1, Math.ceil(height / pitch));
  const cellWidth = width / columns;
  const cellHeight = height / rows;
  const spriteSize = Math.min(desiredSize, cellWidth * 0.9, cellHeight * 0.9);
  const rectangles: TurtlePixelRect[] = [];
  for (let tileY = 0; tileY < rows; tileY++) {
    for (let tileX = 0; tileX < columns; tileX++) {
      TURTLE_GRID.forEach((row, y) => {
        for (let x = 0; x < row.length;) {
          const role = row[x]!;
          let end = x + 1;
          while (end < row.length && row[end] === role) end++;
          if (role !== '.') {
            rectangles.push({
              x: (tileX * cellWidth + (cellWidth - spriteSize) / 2 + (x * spriteSize) / 16) / width,
              y: (tileY * cellHeight + (cellHeight - spriteSize) / 2 + (y * spriteSize) / 16) / height,
              width: ((end - x) * spriteSize) / (16 * width),
              height: spriteSize / (16 * height),
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
    layout: { columns, rows, spriteSize, cellWidth, cellHeight },
    expansion: {
      cost: { primitives: rectangles.length, dom: rectangles.length, definitions: 0, movingGroups: 0 },
      patterns: [],
    },
    usesBlackShadow: false,
  };
}
