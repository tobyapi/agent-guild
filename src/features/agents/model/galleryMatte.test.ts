import { expect, it } from 'vitest';
import { removeGalleryBackground } from './galleryMatte';

const width = 7;
const height = 7;
const white = [253, 253, 253, 255];
const outline = [60, 64, 84, 255];

function pixels() {
  const data = new Uint8ClampedArray(Array.from({ length: width * height }, () => white).flat());
  for (let y = 1; y < 5; y++) {
    for (let x = 1; x < 5; x++) {
      if (x === 1 || x === 4 || y === 1 || y === 4) data.set(outline, (y * width + x) * 4);
    }
  }
  return data;
}

function pixel(data: Uint8ClampedArray, x: number, y: number) {
  const offset = (y * width + x) * 4;
  return Array.from(data.slice(offset, offset + 4));
}

it('removes the outer backdrop and keeps light details inside the outline', () => {
  const data = pixels();
  data.set([228, 230, 232, 255], (2 * width + 0) * 4);
  expect(removeGalleryBackground(data, width, height)).toBe(true);
  expect(pixel(data, 0, 0)[3]).toBe(0);
  expect(pixel(data, 1, 2)).toEqual(outline);
  expect(pixel(data, 2, 2)).toEqual(white);
  expect(pixel(data, 0, 2)[3]).toBeGreaterThan(0);
  expect(pixel(data, 0, 2)[3]).toBeLessThan(255);
  expect(pixel(data, 0, 2)[0]).toBeLessThan(228);
});

it('can clear a marked gap and the shadow below a portrait', () => {
  const data = pixels();
  data.set([224, 225, 230, 255], (5 * width + 2) * 4);
  expect(removeGalleryBackground(data, width, height, { gaps: [[0.3, 0.3]], floorShadowFrom: 0.7 })).toBe(true);
  expect(pixel(data, 2, 2)[3]).toBe(0);
  expect(pixel(data, 2, 5)[3]).toBe(0);
  expect(pixel(data, 4, 4)).toEqual(outline);
});

it('preserves existing transparency and rejects an image without a usable backdrop', () => {
  const transparent = pixels();
  transparent[3] = 0;
  transparent[7] = 105;
  const copy = transparent.slice();
  expect(removeGalleryBackground(transparent, width, height)).toBe(true);
  expect(transparent).toEqual(copy);
  const opaque = new Uint8ClampedArray(Array.from({ length: width * height }, () => outline).flat());
  expect(removeGalleryBackground(opaque, width, height)).toBe(false);
});
