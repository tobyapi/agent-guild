import { reject } from './checks';
import type { PlacementRect } from './placement';

export interface ArtworkFrame {
  tag: 'g';
  transform: string;
  bounds: PlacementRect;
  motionEnvelope: PlacementRect;
  motion: {
    drift: readonly [number, number];
    swayDegrees: number;
    swayMatrixScale: readonly [number, number];
    origin: readonly [number, number];
  };
}

// Components draw in [0,1] squared, including strokes and fixed shadows.
export function fitArtwork(
  frame: PlacementRect,
  viewport: readonly [number, number],
  motion: 'none' | 'drift' | 'sway',
): ArtworkFrame {
  const [width, height] = viewport;
  const frameWidth = (frame.width * width) / 1000;
  const frameHeight = (frame.height * height) / 1000;
  const drift = motion === 'drift' ? 8 : 0;
  const angle = motion === 'sway' ? (2 * Math.PI) / 180 : 0;
  const rotationFactor = Math.cos(angle) + Math.sin(angle);
  const size = (Math.min(frameWidth, frameHeight) - 2 * drift) / rotationFactor;
  if (!Number.isFinite(size) || size <= 0) reject('$', 'invalid_expansion');
  const sx = (size * 1000) / width;
  const sy = (size * 1000) / height;
  if (![sx, sy, width / height, height / width].every(Number.isFinite)) reject('$', 'invalid_expansion');
  const x = (frame.width - sx) / 2;
  const y = (frame.height - sy) / 2;
  const envelopeWidth = ((size * rotationFactor + 2 * drift) * 1000) / width;
  const envelopeHeight = ((size * rotationFactor + 2 * drift) * 1000) / height;
  return {
    tag: 'g',
    transform: `translate(${x} ${y}) scale(${sx} ${sy})`,
    bounds: { x, y, width: sx, height: sy },
    motionEnvelope: {
      x: frame.x + (frame.width - envelopeWidth) / 2,
      y: frame.y + (frame.height - envelopeHeight) / 2,
      width: envelopeWidth,
      height: envelopeHeight,
    },
    motion: {
      drift: [(drift * 1000) / width, (drift * 1000) / height],
      swayDegrees: motion === 'sway' ? 2 : 0,
      swayMatrixScale: [width / height, height / width],
      origin: [frame.width / 2, frame.height / 2],
    },
  };
}
