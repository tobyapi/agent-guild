import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
const tokens = read('src/shared/ui/theme/tokens-backdrop.css');

test('three surfaces preserve original colors without a background and use theme-specific scrim density', () => {
  const defaults = tokens.split(":root[data-background='active']")[0];
  for (const [pane, original] of Object.entries({ chat: 'app', sidebar: 'sidebar', members: 'panel' })) {
    assert.ok(defaults.includes(`--surface-${pane}: var(--bg-${original});`));
    assert.ok(
      tokens.includes(
        `--surface-${pane}: color-mix(in srgb, var(--bg-${original}) var(--scrim-${pane}), transparent);`,
      ),
    );
    assert.ok(defaults.includes(`--scrim-${pane}: 89%;`));
    const light = defaults.split(":root[data-theme='light']")[1];
    assert.ok(light.includes(`--scrim-${pane}: 90%;`));
  }
  for (const [path, pane] of [
    ['src/app/AppShell.module.css', 'chat'],
    ['src/app/Sidebar.module.css', 'sidebar'],
    ['src/features/channels/components/MemberPanel.module.css', 'members'],
  ])
    assert.ok(read(path).includes(`background: var(--surface-${pane});`));
});

test('state faces stay opaque and the actual animation is paused unless explicitly running', () => {
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
  assert.ok(css.includes('animation-play-state: paused;'));
  assert.ok(css.includes("[data-running='true']::after"));
  assert.ok(css.includes('@media (prefers-reduced-motion: reduce)'));
  assert.doesNotMatch(css, /opacity\s*:|z-index:\s*-/);
});
