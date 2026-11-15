import { reject } from './checks';
import type { BackdropGeometry } from './clipping';
import type { ColorExpansion } from './envelope';
import { buildBackdropSkeleton } from './skeleton';
import type { BackdropLayer, BackdropSkeleton } from './skeleton';
import { validateRecipeStructure } from './structure';
import { buildTurtleArtwork } from './turtle';
import type { TurtleArtwork } from './turtle';

export interface TileTurtleBackdrop {
  skeleton: BackdropSkeleton;
  palette: string[];
  artworks: TurtleArtwork[];
  colorExpansion: ColorExpansion;
}

export function buildTileTurtleBackdrop(
  recipe: unknown,
  scheme: 'light' | 'dark',
  geometry: BackdropGeometry,
): TileTurtleBackdrop {
  validateRecipeStructure(recipe);
  if (scheme !== 'light' && scheme !== 'dark') reject('palette', 'invalid_scheme');
  const input = recipe as { layers: BackdropLayer[]; palette: Record<'light' | 'dark', string[]> };
  input.layers.forEach((layer, index) => {
    if (layer.kind !== 'tile' || layer.motif !== 'turtle') reject(`layers[${index}]`, 'unsupported_artwork');
  });
  const palette = [...input.palette[scheme]];
  const artworks = input.layers.map((layer) => buildTurtleArtwork(layer, palette.length));
  const content = artworks.map(({ expansion }, index) => ({
    cost: {
      ...expansion.cost,
      // The full-canvas opaque underlay is rendered once before the clipped layers.
      primitives: expansion.cost.primitives + (index === 0 ? 1 : 0),
      dom: expansion.cost.dom + (index === 0 ? 1 : 0),
    },
    patterns: expansion.patterns,
  }));
  const surface = palette[0]!;
  return {
    skeleton: buildBackdropSkeleton(recipe, content, geometry),
    palette,
    artworks,
    colorExpansion: {
      underlay: [1, 3, 5].map((start) => parseInt(surface.slice(start, start + 2), 16) / 255) as [
        number,
        number,
        number,
      ],
      usesBlackShadow: false,
    },
  };
}
