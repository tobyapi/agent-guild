import { fitArtwork } from './artwork';
import type { ArtworkFrame } from './artwork';
import { buildBackdropClip, QUIET_CENTER } from './clipping';
import type { BackdropClip, BackdropGeometry } from './clipping';
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
  clipPath: string;
  motionGroup: { tag: 'g'; transform: string; artwork: ArtworkFrame };
}

export interface BackdropSkeleton {
  svg: {
    tag: 'svg';
    viewBox: readonly [0, 0, 1000, 1000];
    preserveAspectRatio: 'none';
    ariaHidden: true;
    defs: { tag: 'defs'; clip: BackdropClip };
    children: SvgLayerFrame[];
  };
  viewport: readonly [number, number];
  quietCenter: PlacementRect;
  baseCost: DrawingCost;
  expansions: LayerExpansion[];
  cost: DrawingCost;
}

// Drawing metadata is supplied by app-owned components, never by Recipe JSON.
// An omitted argument means an empty skeleton; it does not estimate future artwork.
export function buildBackdropSkeleton(
  recipe: unknown,
  content?: readonly LayerExpansion[],
  geometry: BackdropGeometry = { viewport: [1000, 1000] },
): BackdropSkeleton {
  validateRecipeStructure(recipe);
  const input = recipe as { seed: number; layers: BackdropLayer[] };
  if (content && content.length !== input.layers.length) reject('$', 'invalid_expansion');
  const clip = buildBackdropClip(geometry);
  const random = placementRandom(input.seed);
  const children: SvgLayerFrame[] = input.layers.map((layer, index) => {
    const frame = placeLayer(layer.anchor, layer.scale, random);
    return {
      tag: 'g',
      index,
      layer: { ...layer },
      frame,
      clipPath: `url(#${clip.id})`,
      motionGroup: {
        tag: 'g',
        transform: `translate(${frame.x} ${frame.y})`,
        artwork: fitArtwork(frame, geometry.viewport, layer.motion),
      },
    };
  });
  const rectangles = clip.rectangles.length;
  const baseCost = { primitives: rectangles, dom: 3 + rectangles, definitions: 1, movingGroups: 0 };
  const expansions = input.layers.map((layer, index) => withGroupCost(layer, content?.[index]));
  const cost = validateRecipeCost(recipe, BACKDROP_VIEWBOX.slice(2), baseCost, expansions);
  return {
    svg: {
      tag: 'svg',
      viewBox: BACKDROP_VIEWBOX,
      preserveAspectRatio: 'none',
      ariaHidden: true,
      defs: { tag: 'defs', clip },
      children,
    },
    viewport: [...geometry.viewport],
    quietCenter: { ...QUIET_CENTER },
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
      dom: cost.dom + 3,
      movingGroups: cost.movingGroups + (layer.motion === 'none' ? 0 : 1),
    },
    patterns: content?.patterns.map((pattern) => ({ ...pattern })) ?? [],
  };
}
