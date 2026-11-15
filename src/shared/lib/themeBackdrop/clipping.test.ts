import { describe, expect, it } from 'vitest';
import { behaviorFixture } from '../behaviorFixtures.test-support';
import { buildBackdropSkeleton } from './index';
import type { BackdropLayer, PlacementRect } from './index';

const valid = behaviorFixture<{ input: { seed: number; layers: BackdropLayer[] }; expected: { valid: boolean } }[]>(
  'theme-backdrop-recipe.json',
).filter((item) => item.expected.valid);
const viewports = [
  [1600, 900],
  [2100, 900],
  [900, 1600],
] as const;
function intersects(a: PlacementRect, b: PlacementRect): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

describe('fixed protection clip and physical artwork bounds', () => {
  it.each(viewports)('keeps motion envelopes and aspect ratio at %j', (...viewport) => {
    let checked = 0;
    for (const seed of [0, 1, 42, 4294967295]) {
      for (const scale of [0.25, 0.7, 1]) {
        for (const anchor of ['left', 'right', 'bottomLeft', 'bottomRight'] as const) {
          for (const motion of ['none', 'drift', 'sway'] as const) {
            const input = structuredClone(valid[0]!.input);
            input.seed = seed;
            input.layers = [
              {
                ...input.layers[0]!,
                kind: 'paper',
                motif: motion === 'sway' ? 'seaweed' : 'wave',
                anchor,
                scale,
                motion,
              },
            ];
            const result = buildBackdropSkeleton(input, undefined, { viewport });
            const group = result.svg.children[0]!;
            const box = group.motionGroup.artwork.motionEnvelope;
            expect(intersects(box, result.quietCenter)).toBe(false);
            expect(box.x).toBeGreaterThanOrEqual(group.frame.x - 1e-10);
            expect(box.y).toBeGreaterThanOrEqual(group.frame.y - 1e-10);
            expect(box.x + box.width).toBeLessThanOrEqual(group.frame.x + group.frame.width + 1e-10);
            expect(box.y + box.height).toBeLessThanOrEqual(group.frame.y + group.frame.height + 1e-10);
            const art = group.motionGroup.artwork;
            expect(art.bounds.width * viewport[0]).toBeCloseTo(art.bounds.height * viewport[1], 8);
            expect((art.motion.drift[0] * viewport[0]) / 1000).toBe(motion === 'drift' ? 8 : 0);
            expect(art.motion.swayDegrees).toBe(motion === 'sway' ? 2 : 0);
            expect(art.motion.swayMatrixScale).toEqual([viewport[0] / viewport[1], viewport[1] / viewport[0]]);
            expect(JSON.stringify(result)).toBe(JSON.stringify(buildBackdropSkeleton(input, undefined, { viewport })));
            checked++;
          }
        }
      }
    }
    expect(checked).toBe(144);
  });

  it('contains physically rotated corners at boundary and intermediate sway angles', () => {
    const input = structuredClone(valid[0]!.input);
    input.layers = [{ ...input.layers[0]!, kind: 'paper', motif: 'seaweed', motion: 'sway' }];
    for (const viewport of viewports) {
      const group = buildBackdropSkeleton(input, undefined, { viewport }).svg.children[0]!;
      const art = group.motionGroup.artwork;
      const envelope = art.motionEnvelope;
      for (const degrees of [-2, -1, 0, 1, 2]) {
        const t = (degrees * Math.PI) / 180;
        const [b, c] = art.motion.swayMatrixScale;
        for (const u of [-0.5, 0.5]) {
          for (const v of [-0.5, 0.5]) {
            const x = u * art.bounds.width;
            const y = v * art.bounds.height;
            const rx = Math.cos(t) * x - c * Math.sin(t) * y;
            const ry = b * Math.sin(t) * x + Math.cos(t) * y;
            expect(Math.abs(rx) * 2).toBeLessThanOrEqual(envelope.width + 1e-10);
            expect(Math.abs(ry) * 2).toBeLessThanOrEqual(envelope.height + 1e-10);
            expect(Math.hypot(rx * viewport[0], ry * viewport[1])).toBeCloseTo(
              Math.hypot(x * viewport[0], y * viewport[1]),
              8,
            );
          }
        }
      }
    }
  });

  it('applies a stationary shared clip to every layer, excluding overlapping text regions', () => {
    const input = structuredClone(valid[0]!.input);
    input.layers = valid.map((item) => ({ ...item.input.layers[0]!, motion: 'none' }));
    const textProtection = [
      { x: 0, y: 200, width: 400, height: 400 },
      { x: 0, y: 300, width: 1000, height: 100 },
    ];
    const before = structuredClone(textProtection);
    const result = buildBackdropSkeleton(input, undefined, {
      viewport: [2100, 900],
      textProtection,
      clipId: 'preview-1',
    });
    const clip = result.svg.defs.clip;
    expect(clip.tag).toBe('clipPath');
    expect(result.svg.children.every((group) => !('transform' in group))).toBe(true);
    expect(result.svg.children.every((group) => group.motionGroup.tag === 'g')).toBe(true);
    expect(clip.clipPathUnits).toBe('userSpaceOnUse');
    expect(result.svg.children.every((layer) => layer.clipPath === 'url(#preview-1)')).toBe(true);
    for (const rect of clip.rectangles) {
      for (const hole of [result.quietCenter, ...textProtection]) expect(intersects(rect, hole)).toBe(false);
    }
    expect(textProtection).toEqual(before);
    expect(result.cost).toEqual({
      primitives: clip.rectangles.length,
      dom: 3 + clip.rectangles.length + 3 * input.layers.length,
      definitions: 1,
      movingGroups: 0,
    });
  });

  it('retains exactly the complement area and can clip the entire viewport', () => {
    const input = valid[0]!.input;
    const result = buildBackdropSkeleton(input);
    const rects = result.svg.defs.clip.rectangles;
    expect(rects.reduce((area, rect) => area + rect.width * rect.height, 0)).toBe(1000000 - 520 * 840);
    rects.forEach((rect, i) => rects.slice(i + 1).forEach((other) => expect(intersects(rect, other)).toBe(false)));
    const covered = buildBackdropSkeleton(input, undefined, {
      viewport: [1000, 1000],
      textProtection: [{ x: -100, y: -100, width: 1200, height: 1200 }],
    });
    expect(covered.svg.defs.clip.rectangles).toEqual([]);
    expect(covered.baseCost).toEqual({ primitives: 0, dom: 3, definitions: 1, movingGroups: 0 });
  });

  it('counts protection definitions before enforcing the existing budget', () => {
    expect(() =>
      buildBackdropSkeleton(valid[0]!.input, [
        {
          cost: { primitives: 0, dom: 0, definitions: 32, movingGroups: 0 },
          patterns: [],
        },
      ]),
    ).toThrow(expect.objectContaining({ code: 'definition_budget_exceeded' }));
  });

  it('rejects invalid app geometry and insufficient space for drift', () => {
    for (const viewport of [
      [0, 1000],
      [NaN, 1000],
      [Infinity, 1000],
    ] as const) {
      expect(() => buildBackdropSkeleton(valid[0]!.input, undefined, { viewport })).toThrow(
        expect.objectContaining({ code: 'invalid_expansion' }),
      );
    }
    const input = structuredClone(valid[0]!.input);
    input.layers = [{ ...input.layers[0]!, kind: 'paper', motif: 'wave', motion: 'drift' }];
    expect(() => buildBackdropSkeleton(input, undefined, { viewport: [10, 10] })).toThrow();
    expect(() => buildBackdropSkeleton(input, undefined, { viewport: [1000, 1000], clipId: 'bad#id' })).toThrow();
    expect(() =>
      buildBackdropSkeleton(input, undefined, {
        viewport: [1000, 1000],
        textProtection: [{ x: 0, y: 0, width: -1, height: 3 }],
      }),
    ).toThrow();
  });
});
