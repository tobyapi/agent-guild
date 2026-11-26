const BACKGROUND_TOLERANCE = 12;
const EDGE_TOLERANCE = 44;

type RGB = readonly [number, number, number];
type Point = readonly [number, number];

export interface GalleryMatte {
  gaps?: readonly Point[];
  floorShadowFrom?: number;
}

function backgroundColor(data: Uint8ClampedArray, width: number, height: number): RGB {
  const samples = [0, 1, 2].map((channel) => {
    const values: number[] = [];
    for (let step = 0; step < 32; step++) {
      const x = Math.floor((step * (width - 1)) / 31);
      const y = Math.floor((step * (height - 1)) / 31);
      for (const index of [x, (height - 1) * width + x, y * width, y * width + width - 1]) {
        values.push(data[index * 4 + channel]!);
      }
    }
    values.sort((a, b) => a - b);
    return values[Math.floor(values.length / 2)]!;
  });
  return [samples[0]!, samples[1]!, samples[2]!];
}

function colorDistances(data: Uint8ClampedArray, background: RGB, shadowStart: number): Uint8Array {
  const distances = new Uint8Array(data.length / 4);
  for (let i = 0; i < distances.length; i++) {
    const offset = i * 4;
    const r = data[offset]!;
    const g = data[offset + 1]!;
    const b = data[offset + 2]!;
    const distance = Math.max(Math.abs(r - background[0]), Math.abs(g - background[1]), Math.abs(b - background[2]));
    const lightGray = Math.max(r, g, b) - Math.min(r, g, b) <= 14 && distance <= 44;
    distances[i] = i >= shadowStart && lightGray ? BACKGROUND_TOLERANCE : distance;
  }
  return distances;
}

function floodBackground(distances: Uint8Array, width: number, height: number, gaps: readonly Point[]): Uint8Array {
  const mask = new Uint8Array(distances.length);
  const queue = new Uint32Array(distances.length);
  let tail = 0;
  function visit(index: number) {
    if (mask[index] || distances[index]! > BACKGROUND_TOLERANCE) return;
    mask[index] = 1;
    queue[tail++] = index;
  }

  for (let x = 0; x < width; x++) {
    visit(x);
    visit((height - 1) * width + x);
  }
  for (let y = 0; y < height; y++) {
    visit(y * width);
    visit(y * width + width - 1);
  }
  for (const [x, y] of gaps) visit(Math.floor(y * height) * width + Math.floor(x * width));
  for (let head = 0; head < tail; head++) {
    const index = queue[head]!;
    const x = index % width;
    if (x > 0) visit(index - 1);
    if (x < width - 1) visit(index + 1);
    if (index >= width) visit(index - width);
    if (index < width * (height - 1)) visit(index + width);
  }
  return mask;
}

function touchesBackground(mask: Uint8Array, index: number, width: number): boolean {
  return Boolean(
    mask[index - width] ||
    mask[index + width] ||
    (index % width > 0 && mask[index - 1]) ||
    (index % width < width - 1 && mask[index + 1]),
  );
}

function softenEdge(data: Uint8ClampedArray, offset: number, distance: number, background: RGB) {
  const alpha = (distance - BACKGROUND_TOLERANCE) / (EDGE_TOLERANCE - BACKGROUND_TOLERANCE);
  for (let channel = 0; channel < 3; channel++) {
    const matte = background[channel]!;
    data[offset + channel] = matte + (data[offset + channel]! - matte) / alpha;
  }
  data[offset + 3] = alpha * 255;
}

function applyMatte(data: Uint8ClampedArray, mask: Uint8Array, distances: Uint8Array, background: RGB, width: number) {
  for (let index = 0; index < mask.length; index++) {
    const offset = index * 4;
    const distance = distances[index]!;
    if (mask[index]) {
      data[offset + 3] = 0;
    } else if (distance > BACKGROUND_TOLERANCE && distance < EDGE_TOLERANCE && touchesBackground(mask, index, width)) {
      softenEdge(data, offset, distance, background);
    }
  }
}

/** Remove a near-white gallery backdrop in place while preserving opaque interior details. */
export function removeGalleryBackground(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  { gaps = [], floorShadowFrom = 1 }: GalleryMatte = {},
): boolean {
  // JEV already has an alpha channel. Keep its original edge colors and coverage.
  if (data.some((value, index) => index % 4 === 3 && value === 0)) return true;

  const background = backgroundColor(data, width, height);
  if (Math.min(...background) < 235 || Math.max(...background) - Math.min(...background) > 8) return false;
  const distances = colorDistances(data, background, Math.ceil(floorShadowFrom * height) * width);
  const mask = floodBackground(distances, width, height, gaps);
  const backgroundPixels = mask.reduce((sum, value) => sum + value, 0);
  if (backgroundPixels < mask.length * 0.05 || backgroundPixels > mask.length * 0.95) return false;

  applyMatte(data, mask, distances, background, width);
  return true;
}
