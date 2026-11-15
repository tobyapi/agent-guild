import { reject } from './checks';
import { anchorBounds } from './placement';
import type { BackdropLayer } from './skeleton';

export const TILE_ASPECT_MIN = 9 / 21;
export const TILE_ASPECT_MAX = 32 / 9;

export function tileRepetitionSize(
  layer: BackdropLayer,
  viewport: readonly [number, number],
): readonly [number, number] {
  if (!viewport.every((value) => Number.isFinite(value) && value > 0)) reject('$', 'invalid_expansion');
  const ratio = Math.max(TILE_ASPECT_MIN, Math.min(TILE_ASPECT_MAX, viewport[0] / viewport[1]));
  const bounds = anchorBounds(layer.anchor);
  return [bounds.width * ratio, bounds.height];
}

export function tileGrid(layer: BackdropLayer, size: readonly [number, number]): readonly [number, number] {
  const pitch = 1.2 * layer.scale * (2 - layer.density);
  const short = Math.min(...size);
  return [Math.max(1, Math.ceil(size[0] / short / pitch)), Math.max(1, Math.ceil(size[1] / short / pitch))];
}

// For each layer the count increases with max(frameAspect, 1/frameAspect).
// Its maximum over a closed aspect interval therefore occurs at an endpoint.
export function worstTileRepetitionSize(layer: BackdropLayer): readonly [number, number] {
  const ends = [TILE_ASPECT_MIN, TILE_ASPECT_MAX].map((ratio) => tileRepetitionSize(layer, [ratio, 1]));
  return ends.reduce((worst, size) => {
    const [wc, wr] = tileGrid(layer, worst);
    const [c, r] = tileGrid(layer, size);
    return c * r > wc * wr ? size : worst;
  });
}
