import { describe, expect, it } from 'vitest';
import { behaviorFixture } from '../behaviorFixtures.test-support';
import { buildTileTurtleBackdrop } from './tileTurtle';
import type { BackdropLayer } from './skeleton';
import { tileGrid, tileRepetitionSize, worstTileRepetitionSize } from './tileLayout';

const recipe = behaviorFixture<{ name: string; input: { layers: BackdropLayer[] } }[]>(
  'theme-backdrop-recipe.json',
).find((item) => item.name === 'tile-turtle-none')!.input;
const sizes = [
  [1280, 720],
  [1920, 1080],
  [2520, 1080],
  [2560, 1440],
  [3440, 1440],
  [3840, 2160],
  [5120, 1440],
  [1080, 1920],
] as const;

describe('viewport independent tile admission', () => {
  it.each(sizes)('scales %s by %s without changing count or admission', (w, h) => {
    const a = buildTileTurtleBackdrop(recipe, 'light', { viewport: [w, h] });
    const b = buildTileTurtleBackdrop(recipe, 'light', { viewport: [w * 3, h * 3] });
    expect(a.skeleton.cost).toEqual(b.skeleton.cost);
    expect(a.budgetCost).toEqual({ primitives: 191, dom: 197, definitions: 1, movingGroups: 0 });
    expect(a.artworks[0]!.rectangles).toEqual(b.artworks[0]!.rectangles);
    expect(a.skeleton.cost.dom).toBeLessThanOrEqual(a.budgetCost.dom);
  });

  it.each([
    [9, 21],
    [32, 9],
    [1, 10000],
    [10000, 1],
  ] as const)('admits or refuses before drawing at %s:%s', (w, h) => {
    const a = buildTileTurtleBackdrop(recipe, 'light', { viewport: [w, h] });
    expect(a.skeleton.cost.dom).toBeLessThanOrEqual(a.budgetCost.dom);
    for (const rect of a.artworks[0]!.rectangles) {
      expect(rect.x + rect.width).toBeLessThan(1);
      expect(rect.y + rect.height).toBeLessThan(1);
      expect((rect.width * w) / (rect.height * h)).toBeCloseTo(Math.round((rect.width * w) / (rect.height * h)), 7);
    }
    const dense = structuredClone(recipe);
    dense.layers[0]!.density = 1;
    expect(() => buildTileTurtleBackdrop(dense, 'light', { viewport: [w, h] })).toThrow(
      expect.objectContaining({ field: 'layers', code: 'dom_budget_exceeded' }),
    );
  });

  it('clamps counts at both supported aspect endpoints', () => {
    for (const [outside, end] of [
      [
        [1, 10000],
        [9, 21],
      ],
      [
        [10000, 1],
        [32, 9],
      ],
    ] as const) {
      expect(tileRepetitionSize(recipe.layers[0]!, outside)).toEqual(tileRepetitionSize(recipe.layers[0]!, end));
    }
  });

  it('bounds all anchors and scale/density combinations over the entire aspect interval', () => {
    for (const anchor of ['left', 'right', 'bottomLeft', 'bottomRight'] as const) {
      for (const scale of [0.25, 0.5, 0.7, 1])
        for (const density of [0, 0.5, 1]) {
          const layer = { ...recipe.layers[0]!, anchor, scale, density };
          const [wc, wr] = tileGrid(layer, worstTileRepetitionSize(layer));
          for (let i = 0; i <= 1000; i++) {
            const [c, r] = tileGrid(layer, tileRepetitionSize(layer, [9 / 21 + ((32 / 9 - 9 / 21) * i) / 1000, 1]));
            expect(c * r).toBeLessThanOrEqual(wc * wr);
          }
        }
    }
  });
});
