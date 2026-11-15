import { reject } from './checks';
import { validateRecipeCost } from './cost';
import type { DrawingCost, LayerExpansion } from './cost';
import { BACKDROP_VIEWBOX, placeLayer, placementRandom } from './placement';
import type { BackdropAnchor, PlacementRect } from './placement';
import { validateRecipeStructure } from './structure';

export interface BackdropLayer {
  kind: 'tile' | 'halftone' | 'paper' | 'symbol';
  motif: string;
  anchor: BackdropAnchor;
  color: number;
  scale: number;
  density: number;
  depth: number;
  motion: 'none' | 'drift' | 'sway';
}

export interface SvgLayerFrame {
  tag: 'g';
  index: number;
  layer: BackdropLayer;
  frame: PlacementRect;
  transform: string;
}

export interface BackdropSkeleton {
  svg: {
    tag: 'svg';
    viewBox: readonly [0, 0, 1000, 1000];
    preserveAspectRatio: 'none';
    ariaHidden: true;
    children: SvgLayerFrame[];
  };
  baseCost: DrawingCost;
  expansions: LayerExpansion[];
  cost: DrawingCost;
}

// Drawing metadata is supplied by app-owned components, never by Recipe JSON.
// An omitted argument means an empty skeleton; it does not estimate future artwork.
export function buildBackdropSkeleton(recipe: unknown, content?: readonly LayerExpansion[]): BackdropSkeleton {
  validateRecipeStructure(recipe);
  const input = recipe as { seed: number; layers: BackdropLayer[] };
  if (content && content.length !== input.layers.length) reject('$', 'invalid_expansion');
  const random = placementRandom(input.seed);
  const children: SvgLayerFrame[] = input.layers.map((layer, index) => {
    const frame = placeLayer(layer.anchor, layer.scale, random);
    return { tag: 'g', index, layer: { ...layer }, frame, transform: `translate(${frame.x} ${frame.y})` };
  });
  const baseCost = { primitives: 0, dom: 1, definitions: 0, movingGroups: 0 };
  const expansions = input.layers.map((layer, index) => withGroupCost(layer, content?.[index]));
  const cost = validateRecipeCost(recipe, BACKDROP_VIEWBOX.slice(2), baseCost, expansions);
  return {
    svg: { tag: 'svg', viewBox: BACKDROP_VIEWBOX, preserveAspectRatio: 'none', ariaHidden: true, children },
    baseCost,
    expansions,
    cost,
  };
}

function withGroupCost(layer: BackdropLayer, content?: LayerExpansion): LayerExpansion {
  const cost = content?.cost ?? { primitives: 0, dom: 0, definitions: 0, movingGroups: 0 };
  // Validate before adding shell counts; e.g. a negative content count must not become zero.
  if (Object.values(cost).some((value) => !Number.isSafeInteger(value) || value < 0)) {
    reject('$', 'invalid_expansion');
  }
  return {
    cost: {
      ...cost,
      dom: cost.dom + 1,
      movingGroups: cost.movingGroups + (layer.motion === 'none' ? 0 : 1),
    },
    patterns: content?.patterns.map((pattern) => ({ ...pattern })) ?? [],
  };
}
