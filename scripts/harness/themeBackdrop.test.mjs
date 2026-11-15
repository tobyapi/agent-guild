import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
const tokens = read('src/shared/ui/theme/tokens-backdrop.css');

test('surfaces default to opaque and only become transparent inside the glass guard', () => {
  for (const [pane, surface] of Object.entries({ chat: 'app', sidebar: 'sidebar', members: 'panel' })) {
    assert.ok(tokens.includes(`--surface-${pane}: var(--bg-${surface});`));
    assert.ok(!tokens.includes(`--surface-${pane}: color-mix`));
  }
  const glass = read('src/shared/ui/theme/tokens-glass.css');
  assert.ok(glass.includes('@media (prefers-reduced-transparency: no-preference)'));
  assert.ok(glass.includes('@supports (backdrop-filter: blur(1px))'));
  assert.ok(glass.includes("[data-glass='frosted']"));
  assert.ok(glass.includes('(forced-colors: active)'));
});

test('state faces stay opaque and retired decoration stays absent', () => {
  assert.ok(tokens.includes('--bg-hover: color-mix(in srgb, var(--backdrop-state-ink) 5%, var(--bg-app));'));
  assert.ok(
    tokens.includes(
      '--bg-active: color-mix(in srgb, var(--backdrop-state-ink) var(--backdrop-active-weight), var(--bg-app));',
    ),
  );
  assert.ok(tokens.includes('--bg-overlay: var(--backdrop-overlay);'));
  for (const name of ['input', 'sunken', 'elevated']) assert.ok(!tokens.includes(`--bg-${name}:`));
  const css = read('src/shared/ui/theme/ThemeBackdrop.module.css');
  assert.ok(css.includes('pointer-events: none;'));
  assert.doesNotMatch(css, /data-asset|data-scene|@keyframes|animation:/);
  assert.doesNotMatch(css, /opacity\s*:|z-index:\s*-/);
});
