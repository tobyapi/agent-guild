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
    expect(bounds.width * width).toBeCloseTo(bounds.height * height, 8);
    for (const pixel of model.artworks[0]!.rectangles) {
      expect((pixel.width * bounds.width * width) / (pixel.height * bounds.height * height)).toBeCloseTo(
        pixel.width / pixel.height,
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

  it('rejects unsupported artwork instead of silently omitting it', () => {
    const recipe = structuredClone(fixture);
    recipe.layers[0]!.motif = 'tree';
    expect(() => buildTileTurtleBackdrop(recipe, 'light', props().geometry)).toThrow(
      expect.objectContaining({ code: 'unsupported_artwork' }),
    );
  });

  it('maps density to one or four turtles while respecting the same unit square', () => {
    const recipe = structuredClone(fixture);
    recipe.layers[0]!.density = 0;
    const sparse = buildTileTurtleBackdrop(recipe, 'light', props().geometry);
    recipe.layers[0]!.density = 1;
    const dense = buildTileTurtleBackdrop(recipe, 'light', props().geometry);
    expect(dense.artworks[0]!.rectangles.length).toBe(4 * sparse.artworks[0]!.rectangles.length);
  });
});
