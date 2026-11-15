import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';

const read = (name) => readFileSync(new URL(`../../src/shared/ui/theme/${name}`, import.meta.url), 'utf8');
const backdrop = read('tokens-backdrop.css');
const darkScrims = backdrop.slice(0, backdrop.indexOf(":root[data-theme='light']"));
const lightScrims = backdrop.split(":root[data-theme='light']")[1].split('}')[0];
const rgb = (hex) => hex.match(/[\da-f]{2}/gi).map((part) => parseInt(part, 16));
const token = (css, name) => {
  const rational = css.match(new RegExp(`--${name}:\\s*calc\\((\\d+) / 255 \\* 100%\\);`));
  if (rational) return `${(Number(rational[1]) / 255) * 100}%`;
  const match = css.match(new RegExp(`--${name}:\\s*(#[\\da-f]{6}|[\\d.]+%);`, 'i'));
  assert.ok(match, `missing token ${name}`);
  return match[1];
};
const luminance = (color) =>
  color
    .map((channel) => channel / 255)
    .map((channel) => (channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4))
    .reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0);
const contrast = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
const composite = (foreground, background, alpha) =>
  foreground.map((channel, index) => channel * alpha + background[index] * (1 - alpha));

function assetBounds(asset) {
  const dom = new JSDOM(read(`assets/${asset}.svg`), { contentType: 'image/svg+xml' });
  try {
    const elements = [...dom.window.document.querySelectorAll('*')];
    // Solid, opaque primitives keep all antialiased pixels inside the color bounds.
    // Reject unsupported SVG features rather than silently ignoring their colors.
    const attributes = {
      svg: ['xmlns', 'viewBox'],
      path: ['fill', 'd'],
      circle: ['fill', 'cx', 'cy', 'r'],
    };
    for (const element of elements) {
      assert.ok(attributes[element.localName], `unsupported SVG element ${element.localName}`);
      for (const attribute of element.attributes)
        assert.ok(attributes[element.localName].includes(attribute.name), `unsupported ${attribute.name}`);
    }
    const shapes = elements.slice(1);
    // These geometries expose the brightest orb and darkest foreground inside the
    // viewBox. Geometry changes need a new coverage proof, not just palette bounds.
    assert.equal(elements[0].getAttribute('viewBox'), '0 0 1600 1000');
    assert.deepEqual(
      shapes.map((shape) => shape.localName),
      ['path', 'circle', 'path', 'path'],
    );
    assert.deepEqual(
      shapes.filter((shape) => shape.localName === 'path').map((shape) => shape.getAttribute('d')),
      ['M0 0h1600v1000H0z', 'M0 650Q400 220 850 700T1600 560V1000H0z', 'M0 850Q450 500 1000 880T1600 720V1000H0z'],
    );
    assert.deepEqual(
      ['cx', 'cy', 'r'].map((name) => shapes[1].getAttribute(name)),
      ['1180', '220', asset === 'dawn' ? '180' : '120'],
    );
    const colors = shapes.map((shape) => {
      const fill = shape.getAttribute('fill');
      assert.match(fill, /^#[\da-f]{6}$/i);
      return rgb(fill);
    });
    const bounds = [Math.min, Math.max].map((extreme) =>
      [0, 1, 2].map((index) => extreme(...colors.map((color) => color[index]))),
    );
    for (const bound of bounds) assert.ok(colors.some((color) => color.every((v, i) => v === bound[i])));
    return bounds;
  } finally {
    dom.window.close();
  }
}

for (const theme of ['dark', 'light']) {
  const colors = read(theme === 'dark' ? 'tokens.css' : 'tokens-light.css');
  const scrims = theme === 'dark' ? darkScrims : lightScrims;
  for (const asset of ['dawn', 'night']) {
    test(`${theme} ${asset}: visible shapes and readable text on every pane`, (context) => {
      const bounds = assetBounds(asset);
      const results = [];
      for (const [pane, surface] of Object.entries({ chat: 'app', sidebar: 'sidebar', members: 'panel' })) {
        const alpha = parseFloat(token(scrims, `scrim-${pane}`)) / 100;
        assert.ok(alpha > 0 && alpha < 1);
        const background = rgb(token(colors, `bg-${surface}`));
        const levels = bounds.map((color) => luminance(composite(background, color, alpha)));
        const shapeRatio = contrast(...levels);
        assert.ok(shapeRatio >= 1.15, `${pane}: shape ratio ${shapeRatio}`);
        const luminanceRatio = levels[1] / levels[0];
        assert.ok(luminanceRatio >= 1.15, `${pane}: luminance ratio ${luminanceRatio}`);
        const textContrast = Math.min(
          ...levels.map((level) => contrast(level, luminance(rgb(token(colors, 'text-primary'))))),
        );
        assert.ok(textContrast >= 4.5, `${pane}: primary text contrast ${textContrast}`);
        // Bound every possible aurora frame as well as both static assets for primary text.
        for (const extreme of [
          [0, 0, 0],
          [255, 255, 255],
        ]) {
          const level = luminance(composite(background, extreme, alpha));
          assert.ok(contrast(level, luminance(rgb(token(colors, 'text-primary')))) >= 4.5);
        }
        const mutedContrast = Math.min(
          ...levels.map((level) => contrast(level, luminance(rgb(token(colors, 'text-muted'))))),
        );
        assert.ok(mutedContrast >= 4.5, `${pane}: muted text contrast ${mutedContrast}`);
        results.push({ pane, shapeRatio, luminanceRatio, textContrast, mutedContrast });
      }
      context.diagnostic(JSON.stringify(results));
    });
  }
}
