import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { test } from 'node:test';
import { block, support, fallback } from './lib/glassCss.mjs';

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
const materials = [
  ['src/shared/ui/theme/ThemeBackdrop.module.css', '.backdrop'],
  ['src/app/AppShell.module.css', '.shell::after'],
  ['src/app/Sidebar.module.css', '.sidebar'],
  ['src/features/channels/components/MemberPanel.module.css', '.panel'],
  ['src/features/channels/components/ChannelHeader.module.css', '.header'],
  ['src/features/chat/components/MessageList.module.css', '.jump'],
  ['src/features/chat/components/Composer.module.css', '.composer:not([data-dragging])'],
  ['src/shared/ui/Dialog.module.css', '.dialog'],
  ['src/shared/ui/toast/ToastViewport.module.css', '.toast'],
  ['src/features/chat/components/MentionSuggestions.module.css', '.popover'],
  ['src/features/agents/components/editor/PresetPicker.module.css', '.popover'],
];

test('glass requires an active backdrop and filter support, with reduced/forced-color overrides', () => {
  for (const [file, selector] of materials) {
    const css = read(file);
    assert.doesNotMatch(css, /prefers-reduced-transparency:\s*no-preference/, file);
    const material = block(css, support);
    const reset = block(css, fallback);
    const scoped = `:global(:root[data-background='active'][data-glass='frosted']) ${selector}`;
    assert.ok(material.includes(scoped), file);
    assert.ok(css.indexOf(fallback) > css.indexOf(support), file);
    if (selector === '.backdrop') assert.ok(block(reset, selector).includes('display: none;'), file);
    else if (selector === '.shell::after') assert.ok(block(reset, scoped).includes('content: none;'), file);
    else assert.ok(block(reset, scoped).includes('--glass-ink-weight: 0%;'), file);
    assert.doesNotMatch(css.slice(0, css.indexOf(support)), /backdrop-filter:|filter:\s*blur/);
  }
});

test('one full-window veil replaces reading and per-message protection', () => {
  const shell = read('src/app/AppShell.module.css');
  assert.ok(shell.includes('.shell::after'));
  assert.ok(shell.includes('backdrop-filter: var(--glass-pane-filter)'));
  const list = read('src/features/chat/components/MessageList.module.css');
  assert.doesNotMatch(list, /glass-reading-width|glass-feather/);
  assert.doesNotMatch(read('src/features/chat/components/Message.module.css'), /glass-card-weight|backdrop-filter:/);
  assert.doesNotMatch(read('src/shared/ui/theme/tokens-glass.css'), /98%/);
});

test('every backdrop-filter declaration is opt-in and reduced/forced-color safe', () => {
  const files = readdirSync(new URL('../../src/', import.meta.url), { recursive: true }).filter((f) =>
    f.endsWith('.css'),
  );
  for (const file of files) {
    const css = read(`src/${file}`);
    if (!/\n\s*backdrop-filter:/.test(css)) continue;
    const enabled = block(css, support);
    const reset = block(css, fallback);
    assert.ok(css.indexOf(fallback) > css.indexOf(support), file);
    const rules = [...enabled.matchAll(/([^{}]+)\{([^{}]*)\}/g)];
    for (const [, selector, declarations] of rules) {
      if (!/backdrop-filter:/.test(declarations)) continue;
      assert.ok(selector.includes("[data-background='active'][data-glass='frosted']"), file);
      assert.ok(block(reset, selector.trim()).includes('backdrop-filter: none;'), file);
    }
    const outside = css.replace(enabled, '').replace(reset, '');
    assert.doesNotMatch(outside, /\n\s*backdrop-filter:/, file);
  }
  assert.ok(
    read('src/features/chat/components/Composer.module.css').includes('outline: 2px solid var(--focus-color);'),
  );
});

test('glass ink preserves opaque paint and enables only the guarded transparent panes', () => {
  const ink = read('src/shared/ui/theme/tokens-glass-ink.css');
  const enabled = block(ink, support);
  assert.ok(enabled.includes("[data-background='active'][data-glass='frosted'] *"));
  assert.ok(enabled.includes('var(--glass-ink-weight, 0%)'));
  assert.ok(
    block(block(ink, fallback), ":root[data-background='active'][data-glass='frosted'] *").includes(
      '--glass-ink-weight: 0%;',
    ),
  );
  assert.ok(ink.indexOf(fallback) > ink.indexOf(support));
  for (const [file, selector] of materials.filter(([, selector]) => selector !== '.backdrop')) {
    const css = read(file);
    const guarded = block(css, support);
    assert.ok(guarded.includes('--glass-ink-weight: 100%;'), `${file}/${selector}`);
  }
  for (const file of [
    'src/features/chat/components/MarkdownCode.module.css',
    'src/features/chat/components/TaskCard.module.css',
    'src/shared/ui/field/Field.module.css',
  ]) {
    assert.ok(read(file).includes('--glass-ink-weight: 0%;'), file);
  }
});
