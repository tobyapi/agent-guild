import { anchorBounds, placementRandom } from './placement';
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
  const input = recipe as { seed: number; layers: BackdropLayer[]; palette: Record<'light' | 'dark', string[]> };
  input.layers.forEach((layer, index) => {
    if (layer.kind !== 'tile' || layer.motif !== 'turtle') reject(`layers[${index}]`, 'unsupported_artwork');
  });
  const palette = [...input.palette[scheme]];
  const random = placementRandom(input.seed);
  const artworks = input.layers.map((layer) =>
    buildTurtleArtwork(
      layer,
      palette.length,
      [
        (anchorBounds(layer.anchor).width * geometry.viewport[0]) / 1000,
        (anchorBounds(layer.anchor).height * geometry.viewport[1]) / 1000,
      ],
      [random(), random()],
    ),
  );
  const content = artworks.map(({ expansion }, index) => ({
    cost: {
      ...expansion.cost,
      // The full-canvas opaque underlay is rendered once before the clipped layers.
      primitives: expansion.cost.primitives + (index === 0 ? 1 : 0),
      dom: expansion.cost.dom + (index === 0 ? 1 : 0),
    },
    patterns: expansion.patterns,
  }));
  const skeleton = buildBackdropSkeleton(recipe, content, geometry);
  // Tile has no motion. Its repeated canvas occupies the full anchor, while each
  // sprite compensates for the rectangular canvas in physical viewport pixels.
  for (const child of skeleton.svg.children) {
    const frame = anchorBounds(child.layer.anchor);
    child.frame = frame;
    child.motionGroup.transform = `translate(${frame.x} ${frame.y})`;
    child.motionGroup.artwork = {
      ...child.motionGroup.artwork,
      transform: `translate(0 0) scale(${frame.width} ${frame.height})`,
      bounds: { x: 0, y: 0, width: frame.width, height: frame.height },
      motionEnvelope: { ...frame },
      motion: { ...child.motionGroup.artwork.motion, origin: [frame.width / 2, frame.height / 2] },
    };
  }
  const surface = palette[0]!;
  return {
    skeleton,
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
