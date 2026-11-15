/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { behaviorFixture } from '../behaviorFixtures.test-support';
import type { TokenTable } from './tokenTable';
import { resolveTokenColor } from './tokenColors';
import type { ColorDefinitions } from './tokenColors';

const css = readFileSync('src/shared/ui/theme/tokens-glass.css', 'utf8');
const inkCss = readFileSync('src/shared/ui/theme/tokens-glass-ink.css', 'utf8');
function glassInk(name: string, scheme: string, accent: string, original: readonly number[]) {
  const defs: Record<string, ColorDefinitions[string]> = {};
  for (const block of inkCss.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selector = block[1]!.replace(/\/\*[\s\S]*?\*\//g, '').trim();
    if (!selector.startsWith(':root') || selector.includes('data-background')) continue;
    if (selector.includes("data-theme='light'") && scheme !== 'light') continue;
    const selected = /data-accent='([^']+)'/.exec(selector)?.[1];
    if (selected && selected !== accent) continue;
    for (const declaration of block[2]!.matchAll(/(--[\w-]+): ([^;]+);/g))
      defs[declaration[1]!] = { file: 'tokens-glass-ink.css', line: 1, expression: declaration[2]! };
  }
  const solid = '--solid-' + name.slice(2);
  defs[solid] = { file: 'original', line: 1, expression: `rgb(${original.map((c) => c * 255).join(',')})` };
  return resolveTokenColor(`var(--glass-${name.slice(2)}, var(${solid}))`, defs)!.rgb;
}
const table = behaviorFixture<TokenTable>('theme-backdrop-token-table.json');
const luminance = (rgb: readonly number[]) =>
  rgb.reduce(
    (sum, c, i) => sum + [0.2126, 0.7152, 0.0722][i]! * (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4),
    0,
  );
const saturate = (rgb: number[]) => {
  const gray = rgb.reduce((sum, c, i) => sum + c * [0.213, 0.715, 0.072][i]!, 0);
  return rgb.map((c) => Math.max(0, Math.min(1, gray + (c - gray) * 1.02)));
};

describe('full-window frosted veil', () => {
  for (const scheme of ['dark', 'light'] as const) {
    it(`${scheme}/arbitrary-image bounds every blurred pixel, saturation and floating card at AA`, () => {
      const block = scheme === 'dark' ? css.split('}')[0]! : css.split(":root[data-theme='light']")[1]!.split('}')[0]!;
      expect(block).toContain(`--glass-veil-weight: ${scheme === 'dark' ? 74 : 80}%;`);
      const alpha = Number(block.match(/--glass-veil-weight: ([\d.]+)%;/)![1]) / 100;
      const hex = block.match(/--glass-veil-color: #([\da-f]{6});/)![1]!;
      const veil = hex.match(/../g)!.map((c) => parseInt(c, 16) / 255);
      // Blur is a convex average. All RGB from any image is
      // enclosed by these corners. Recheck saturation of the already veiled
      // screen for floating cards, including half an 8-bit step of rounding.
      const corners = Array.from({ length: 8 }, (_, mask) =>
        veil.map((c, i) => c * alpha + ((mask >> i) & 1) * (1 - alpha)),
      );
      const filtered = corners.map(saturate);
      const low = [0, 1, 2].map((i) =>
        Math.max(0, Math.min(...corners.map((c) => c[i]!), ...filtered.map((c) => c[i]!)) - 0.5 / 255),
      );
      const high = [0, 1, 2].map((i) =>
        Math.min(1, Math.max(...corners.map((c) => c[i]!), ...filtered.map((c) => c[i]!)) + 0.5 / 255),
      );
      let worst = Infinity;
      for (const unit of table.units.filter((u) => u.scheme === scheme)) {
        for (const row of unit.rows.filter((r) => r.status === 'resolved' && r.overlays.length === 0)) {
          const ink = glassInk(row.name, scheme, row.accent, row.text!.rgb);
          const inkLow = luminance(ink.map((c) => Math.max(0, c - 0.5 / 255)));
          const inkHigh = luminance(ink.map((c) => Math.min(1, c + 0.5 / 255)));
          const ratio =
            scheme === 'dark' ? (inkLow + 0.05) / (luminance(high) + 0.05) : (luminance(low) + 0.05) / (inkHigh + 0.05);
          worst = Math.min(worst, ratio);
          // Retain the 4.6 minimum for every resolved text row.
          expect(ratio, `${unit.name}/${row.name}`).toBeGreaterThanOrEqual(4.6);
        }
      }
      console.info(`${scheme}/arbitrary-image: alpha=${alpha}, all-RGB bound=${worst}`);
    });
  }
});

it('keeps already sufficient light violet and silver accent ink unchanged', () => {
  for (const accent of ['violet', 'silver']) {
    const row = table.units
      .find((u) => u.scheme === 'light')!
      .rows.find((r) => r.name === '--accent-text' && r.accent === accent && r.overlays.length === 0)!;
    expect(glassInk(row.name, 'light', accent, row.text!.rgb)).toEqual(row.text!.rgb);
  }
});
