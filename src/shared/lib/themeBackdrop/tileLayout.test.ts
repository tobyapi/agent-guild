import { describe, expect, it } from 'vitest';
import { behaviorFixture } from '../behaviorFixtures.test-support';
import type { BackdropLayer } from './skeleton';
import { tileGrid, tileRepetitionSize, worstTileRepetitionSize } from './tileLayout';

const recipe = behaviorFixture<{ name: string; input: { layers: BackdropLayer[] } }[]>(
  'theme-backdrop-recipe.json',
).find((item) => item.name === 'tile-turtle-none')!.input;

describe('generic tile repetition bounds', () => {
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
