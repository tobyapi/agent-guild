// @vitest-environment jsdom
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { behaviorFixture } from '@/shared/lib/behaviorFixtures.test-support';
import { buildTileTurtleBackdrop } from '@/shared/lib/themeBackdrop';
import type { BackdropLayer } from '@/shared/lib/themeBackdrop';
import { TURTLE_GRID } from '@/shared/lib/themeBackdrop/turtle';
import { TileTurtleBackdrop } from './TileTurtleBackdrop';
import type { TileTurtleBackdropProps } from './TileTurtleBackdrop';

const fixture = behaviorFixture<{ name: string; input: { layers: BackdropLayer[] } }[]>(
  'theme-backdrop-recipe.json',
).find((item) => item.name === 'tile-turtle-none')!.input;
function props(): TileTurtleBackdropProps {
  return {
    recipe: structuredClone(fixture),
    scheme: 'light',
    geometry: { viewport: [1920, 1080], clipId: 'turtle-test' },
  };
}
function render(input: TileTurtleBackdropProps): string {
  return renderToStaticMarkup(createElement(TileTurtleBackdrop, input));
}

describe('tile turtle vertical slice', () => {
  it('renders deterministic SVG without mutating caller data', () => {
    const input = props();
    const before = structuredClone(input);
    expect(render(input)).toBe(render(input));
    expect(input).toEqual(before);
  });

  it('keeps every merged pixel inside the unit square with a transparent border', () => {
    expect(TURTLE_GRID).toHaveLength(16);
    expect(TURTLE_GRID.every((row) => row.length === 16)).toBe(true);
    const { artworks } = buildTileTurtleBackdrop(fixture, 'light', props().geometry);
    for (const rect of artworks[0]!.rectangles) {
      expect(rect.x).toBeGreaterThan(0);
      expect(rect.y).toBeGreaterThan(0);
      expect(rect.x + rect.width).toBeLessThan(1);
      expect(rect.y + rect.height).toBeLessThan(1);
      expect([1, 2, 3]).toContain(rect.color);
    }
  });

  it.each(['light', 'dark'] as const)('uses only %s palette colors and declares no black shadow', (scheme) => {
    const input = { ...props(), scheme };
    const model = buildTileTurtleBackdrop(input.recipe, scheme, input.geometry);
    const doc = new DOMParser().parseFromString(render(input), 'image/svg+xml');
    expect([...doc.querySelectorAll('[fill]')].every((el) => model.palette.includes(el.getAttribute('fill')!))).toBe(
      true,
    );
    expect(doc.querySelector('filter,image,text,use,script,foreignObject')).toBeNull();
    expect(model.colorExpansion.usesBlackShadow).toBe(false);
    expect(model.artworks.every((art) => art.usesBlackShadow === false)).toBe(true);
  });

  it('counts actual DOM, definitions and rectangle primitives including the underlay and clip', () => {
    const input = props();
    const model = buildTileTurtleBackdrop(input.recipe, input.scheme, input.geometry);
    const doc = new DOMParser().parseFromString(render(input), 'image/svg+xml');
    expect(model.skeleton.cost).toEqual({
      primitives: doc.querySelectorAll('rect').length,
      dom: doc.querySelectorAll('*').length,
      definitions: doc.querySelectorAll('clipPath').length,
      movingGroups: 0,
    });
  });

  it('applies fixed clipping outside translation and aspect correction on every layer', () => {
    const input = props();
    const recipe = input.recipe as typeof fixture;
    recipe.layers[0]!.density = 0;
    recipe.layers.push({ ...recipe.layers[0]!, anchor: 'bottomLeft' });
    const doc = new DOMParser().parseFromString(render(input), 'image/svg+xml');
    const groups = doc.querySelectorAll('svg > g');
    expect(groups).toHaveLength(2);
    for (const group of groups) {
      expect(group.getAttribute('clip-path')).toBe('url(#turtle-test)');
      expect(group.hasAttribute('transform')).toBe(false);
      expect(group.children).toHaveLength(1);
      const translation = group.firstElementChild!;
      expect(translation.getAttribute('transform')).toMatch(/^translate/);
      expect(translation.children).toHaveLength(1);
      expect(translation.firstElementChild!.getAttribute('transform')).toMatch(/scale/);
      expect(translation.firstElementChild!.getAttribute('shape-rendering')).toBe('crispEdges');
    }
  });

  it.each([
    [1920, 1080],
    [2520, 1080],
    [1080, 1920],
  ] as const)('preserves square pixels in a %s × %s viewport', (width, height) => {
    const model = buildTileTurtleBackdrop(fixture, 'light', { viewport: [width, height] });
    const { bounds } = model.skeleton.svg.children[0]!.motionGroup.artwork;
    const layout = model.artworks[0]!.layout;
    expect(layout.columns * layout.cellWidth).toBeCloseTo((bounds.width * width) / 1000);
    expect(layout.rows * layout.cellHeight).toBeCloseTo((bounds.height * height) / 1000);
    for (const pixel of model.artworks[0]!.rectangles) {
      expect((pixel.width * bounds.width * width) / (pixel.height * bounds.height * height)).toBeCloseTo(
        Math.round((pixel.width * bounds.width * width) / (pixel.height * bounds.height * height)),
        8,
      );
    }
  });

  it('rejects actual repeated artwork above the DOM budget with the existing code', () => {
    const recipe = structuredClone(fixture);
    recipe.layers = Array.from({ length: 4 }, () => ({ ...recipe.layers[0]! }));
    expect(() => buildTileTurtleBackdrop(recipe, 'light', props().geometry)).toThrow(
      expect.objectContaining({ field: 'layers', code: 'dom_budget_exceeded' }),
    );
  });

  it('rejects huge tile areas before expanding their nodes', () => {
    expect(() => buildTileTurtleBackdrop(fixture, 'light', { viewport: [1e12, 1e12] })).toThrow(
      expect.objectContaining({ field: 'layers', code: 'dom_budget_exceeded' }),
    );
  });

  it('rejects unsupported artwork instead of silently omitting it', () => {
    const recipe = structuredClone(fixture);
    recipe.layers[0]!.motif = 'tree';
    expect(() => buildTileTurtleBackdrop(recipe, 'light', props().geometry)).toThrow(
      expect.objectContaining({ code: 'unsupported_artwork' }),
    );
  });

  it('uses density as spacing across the entire anchor', () => {
    const recipe = structuredClone(fixture);
    recipe.layers[0]!.density = 0;
    const sparse = buildTileTurtleBackdrop(recipe, 'light', props().geometry);
    recipe.layers[0]!.density = 1;
    const dense = buildTileTurtleBackdrop(recipe, 'light', props().geometry);
    expect(dense.artworks[0]!.layout.columns).toBeGreaterThanOrEqual(sparse.artworks[0]!.layout.columns);
    expect(dense.artworks[0]!.layout.rows).toBeGreaterThanOrEqual(sparse.artworks[0]!.layout.rows);
    expect(dense.artworks[0]!.rectangles.length).toBeGreaterThan(sparse.artworks[0]!.rectangles.length);
  });

  it('varies sprite placement with seed, retaining deterministic cell counts', () => {
    const first = buildTileTurtleBackdrop({ ...fixture, seed: 0 }, 'light', props().geometry);
    const last = buildTileTurtleBackdrop({ ...fixture, seed: 4294967295 }, 'light', props().geometry);
    expect(first.artworks[0]!.rectangles).not.toEqual(last.artworks[0]!.rectangles);
    expect(first.artworks[0]!.layout).toEqual(last.artworks[0]!.layout);
  });

  it('keeps additional text protection outside all layer content', () => {
    const input = props();
    input.geometry.textProtection = [{ x: 820, y: 820, width: 90, height: 90 }];
    const model = buildTileTurtleBackdrop(input.recipe, input.scheme, input.geometry);
    for (const rect of model.skeleton.svg.defs.clip.rectangles) {
      expect(rect.x < 910 && rect.x + rect.width > 820 && rect.y < 910 && rect.y + rect.height > 820).toBe(false);
    }
    const doc = new DOMParser().parseFromString(render(input), 'image/svg+xml');
    expect(doc.querySelector('svg > g')!.getAttribute('clip-path')).toBe('url(#turtle-test)');
    expect(model.skeleton.cost.dom).toBe(doc.querySelectorAll('*').length);
  });

  it('has a head, four protruding feet, tail and shell divisions', () => {
    expect(TURTLE_GRID[2].slice(6, 10)).toBe('1221');
    for (const y of [5, 12]) {
      expect(TURTLE_GRID[y]!.slice(1, 4)).toBe('122');
      expect(TURTLE_GRID[y]!.slice(12, 15)).toBe('221');
    }
    expect(TURTLE_GRID[8]).toBe('...1221331221...');
    expect(TURTLE_GRID[14]).toBe('.......11.......');
  });

  it.each(['left', 'right', 'bottomLeft', 'bottomRight'] as const)(
    'fills the %s anchor without escaping its frame',
    (anchor) => {
      const recipe = structuredClone(fixture);
      Object.assign(recipe.layers[0]!, { anchor, scale: 1, density: 0 });
      const model = buildTileTurtleBackdrop(recipe, 'light', props().geometry);
      const frame = model.skeleton.svg.children[0]!;
      expect(frame.frame.height).toBe(anchor === 'left' || anchor === 'right' ? 1000 : 180);
      expect(frame.motionGroup.artwork.motionEnvelope).toEqual(frame.frame);
      const { layout, rectangles } = model.artworks[0]!;
      expect(layout.rows).toBeGreaterThanOrEqual(anchor === 'left' || anchor === 'right' ? 3 : 1);
      for (const rect of rectangles) {
        expect(rect.x).toBeGreaterThan(0);
        expect(rect.y).toBeGreaterThan(0);
        expect(rect.x + rect.width).toBeLessThan(1);
        expect(rect.y + rect.height).toBeLessThan(1);
      }
    },
  );
});
