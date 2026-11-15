import { reject } from './checks';
import { tileGrid } from './tileLayout';
import type { LayerExpansion } from './cost';
import type { BackdropLayer } from './skeleton';

// '.' is transparent; digits are fixed roles mapped to validated palette indices.
export const TURTLE_GRID = Object.freeze([
  '................',
  '.......11.......',
  '......1221......',
  '......1221......',
  '..11.111111.11..',
  '.12211222211221.',
  '..111223322111..',
  '...1222332221...',
  '...1221331221...',
  '...1221331221...',
  '...1222332221...',
  '..111223322111..',
  '.12211222211221.',
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
  phase: readonly [number, number],
  repetitionSize: readonly [number, number] = size,
): TurtleArtwork {
  const roles = [0, layer.color, (layer.color % (paletteLength - 1)) + 1, 1];
  const [width, height] = size;
  if (![width, height].every((value) => Number.isFinite(value) && value > 0)) reject('$', 'invalid_expansion');
  // Scale controls the sprite; density controls its spacing across the entire anchor.
  const desiredSize = Math.min(width, height) * 1.2 * layer.scale;
  const [columns, rows] = tileGrid(layer, repetitionSize);
  // Refuse oversized direct expansions before allocating or iterating them.
  // Every sprite emits at least one DOM node, so this is already over budget.
  if (columns * rows > 400) reject('layers', 'dom_budget_exceeded');
  const cellWidth = width / columns;
  const cellHeight = height / rows;
  const spriteSize = Math.min(desiredSize, cellWidth * 0.9, cellHeight * 0.9);
  const offsetX = (cellWidth - spriteSize) * phase[0];
  const offsetY = (cellHeight - spriteSize) * phase[1];
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
              x: (tileX * cellWidth + offsetX + (x * spriteSize) / 16) / width,
              y: (tileY * cellHeight + offsetY + (y * spriteSize) / 16) / height,
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
