import { expect, it } from 'vitest';
import { DEFAULT_MASCOT_LAYOUT, readMascotSettings } from './mascot';

it('bounds stored positions and sizes and discards malformed image references', () => {
  expect(
    readMascotSettings({
      source: { kind: 'generated', id: '../outside' },
      layout: { mascot: { x: -50, y: 115, size: 600 } },
    }),
  ).toEqual({
    source: { kind: 'default' },
    layout: { ...DEFAULT_MASCOT_LAYOUT, mascot: { x: 0, y: 100, size: 130 } },
  });
});
