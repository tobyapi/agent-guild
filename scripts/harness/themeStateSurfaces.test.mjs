import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const read = (file) => readFileSync(new URL(`../../src/shared/ui/theme/${file}`, import.meta.url), 'utf8');
const inputs = read('tokens-state-inputs.css') + read('tokens-state-accents.css');
const states = read('tokens-state-surfaces.css');
function declarations(css) {
  return [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(([, selector, body]) => ({
    selector: selector
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/@import[^;]+;/g, '')
      .trim(),
    body,
  }));
}

test('all 48 raw state inputs retain their source ink and alpha without precomposing B', () => {
  const raw = declarations(inputs);
  let count = 0;
  for (const file of ['tokens.css', 'tokens-light.css', 'tokens-accent.css']) {
    for (const block of declarations(read(file))) {
      for (const [, name, r, g, b, alpha] of block.body.matchAll(
        /--([\w-]+): rgba\((\d+), (\d+), (\d+), ([\d.]+)\)/g,
      )) {
        if (!name.endsWith('-soft') && !['mention-self-bg', 'selection-bg'].includes(name)) continue;
        const source = raw.find((entry) => entry.selector === block.selector)?.body ?? '';
        assert.ok(source.includes(`--raw-${name}: rgba(${r}, ${g}, ${b}, ${alpha});`), `${block.selector}/${name}`);
        assert.ok(source.includes(`--raw-${name}-ink: rgb(${r} ${g} ${b});`));
        const weight = source.match(new RegExp(`--raw-${name}-weight: ([\\d.]+)%;`));
        assert.equal(Number(weight?.[1]) / 100, Number(alpha));
        count++;
      }
    }
  }
  assert.equal(count, 48);
});

test('B uses one sRGB mix of opaque raw ink and local surface, with no integer output', () => {
  const names = [
    ...states.matchAll(
      /--b-([\w-]+): color-mix\(\s*in srgb,\s*var\(--raw-\1-ink\) var\(--raw-\1-weight\),\s*var\(--surface\)\s*\)/g,
    ),
  ];
  assert.equal(names.length, 12);
  assert.doesNotMatch(states, /#[\da-f]{3,8}\b|rgba?\(|Math\.round|toFixed|transparent/);
  assert.ok(states.includes(":root[data-background='active'] *"));
  assert.ok(states.includes('--b-kind-neutral-soft: var(--bg-active);'));
});
