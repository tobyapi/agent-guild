import { describe, expect, it } from 'vitest';
import { behaviorFixture } from '../behaviorFixtures.test-support';
import { buildBackdropSkeleton } from './index';
import type { BackdropAnchor, BackdropLayer, PlacementRect } from './index';

interface Recipe {
  seed: number;
  layers: BackdropLayer[];
}
const cases = behaviorFixture<{ name: string; input: Recipe; expected: { valid: boolean } }[]>(
  'theme-backdrop-recipe.json',
).filter((item) => item.expected.valid);
const anchors: BackdropAnchor[] = ['left', 'right', 'bottomLeft', 'bottomRight'];
const quiet = { x: 240, y: 80, width: 520, height: 840 };

function recipe(): Recipe {
  return structuredClone(cases[0]!.input);
}
function intersects(a: PlacementRect, b: PlacementRect): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

describe('Backdrop SVG skeleton', () => {
  it.each(cases)('is byte-for-byte deterministic and leaves $name unchanged', ({ input }) => {
    const before = structuredClone(input);
    const first = buildBackdropSkeleton(input);
    expect(JSON.stringify(first)).toBe(JSON.stringify(buildBackdropSkeleton(structuredClone(input))));
    expect(input).toEqual(before);
    expect(first.svg.viewBox).toEqual([0, 0, 1000, 1000]);
    expect(first.svg.ariaHidden).toBe(true);
    expect(first.cost.dom).toBe(7 + 3 * input.layers.length);
    expect(first.cost.primitives).toBe(4);
  });

  it('changes only placement when seed changes, without global random or time', () => {
    const input = recipe();
    const first = buildBackdropSkeleton({ ...input, seed: 1 });
    const second = buildBackdropSkeleton({ ...input, seed: 2 });
    expect(first.svg.children[0]!.frame).not.toEqual(second.svg.children[0]!.frame);
    const withoutPlacement = (skeleton: typeof first) => ({
      ...skeleton,
      svg: {
        ...skeleton.svg,
        children: skeleton.svg.children.map(({ frame, transform, artwork, ...layer }) => {
          expect(transform).toBe(`translate(${frame.x} ${frame.y})`);
          return { ...layer, artwork: { ...artwork, motionEnvelope: undefined } };
        }),
      },
    });
    expect(withoutPlacement(first)).toEqual(withoutPlacement(second));
  });

  it.each([0, 4294967295])('handles seed boundary %i with finite coordinates', (seed) => {
    const input = { ...recipe(), seed };
    const skeleton = buildBackdropSkeleton(input);
    expect(Object.values(skeleton.svg.children[0]!.frame).every(Number.isFinite)).toBe(true);
    expect(skeleton).toEqual(buildBackdropSkeleton(input));
  });

  it.each(anchors)('contains every frame within %s and outside the quiet center', (anchor) => {
    for (const seed of [0, 1, 42, 1000, 4294967295]) {
      for (const scale of [0.25, 0.7, 1]) {
        const input = recipe();
        input.seed = seed;
        input.layers[0] = { ...input.layers[0]!, anchor, scale };
        const frame = buildBackdropSkeleton(input).svg.children[0]!.frame;
        const right = anchor === 'right' || anchor === 'bottomRight';
        expect(frame.x).toBeGreaterThanOrEqual(right ? 820 : 0);
        expect(frame.x + frame.width).toBeLessThanOrEqual(right ? 1000 : 180);
        expect(frame.y).toBeGreaterThanOrEqual(anchor.startsWith('bottom') ? 820 : 0);
        expect(frame.y + frame.height).toBeLessThanOrEqual(1000);
        expect(intersects(frame, quiet)).toBe(false);
      }
    }
  });

  it('preserves painter order and reserves moving groups in the shell', () => {
    const input = recipe();
    input.layers = [
      { ...input.layers[0]!, kind: 'paper', motif: 'wave', motion: 'drift', anchor: 'left' },
      { ...input.layers[0]!, kind: 'symbol', motif: 'tree', motion: 'sway', anchor: 'right' },
      { ...input.layers[0]!, anchor: 'bottomLeft' },
    ];
    const result = buildBackdropSkeleton(input);
    expect(result.svg.children.map((group) => group.layer)).toEqual(input.layers);
    expect(result.svg.children.map((group) => group.index)).toEqual([0, 1, 2]);
    expect(result.cost).toEqual({ primitives: 4, dom: 16, definitions: 1, movingGroups: 2 });
    input.layers[2] = { ...input.layers[0]! };
    expect(() => buildBackdropSkeleton(input)).toThrow(expect.objectContaining({ code: 'motion_budget_exceeded' }));
  });

  it('owns its output without sharing mutable Recipe state between calls', () => {
    const input = recipe();
    const first = buildBackdropSkeleton(input);
    first.svg.children[0]!.layer.scale = 0.25;
    first.svg.children[0]!.frame.x = -1;
    first.cost.dom = 0;
    expect(buildBackdropSkeleton(input).svg.children[0]!.layer.scale).toBe(input.layers[0]!.scale);
    expect(buildBackdropSkeleton(input).svg.children[0]!.frame.x).toBeGreaterThanOrEqual(0);
  });

  it('rejects unvalidated Recipe input at the public entry', () => {
    expect(() => buildBackdropSkeleton({ ...recipe(), seed: -1 })).toThrow(
      expect.objectContaining({ field: 'seed', code: 'out_of_range' }),
    );
  });
});
