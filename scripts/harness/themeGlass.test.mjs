import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { test } from 'node:test';

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

test('glass requires an active backdrop, transparency preference and filter support', () => {
  for (const [file, selector] of materials) {
    const css = read(file);
    const guard = css.indexOf('@media (prefers-reduced-transparency: no-preference)');
    assert.ok(guard >= 0, file);
    const material = css.slice(guard).replace(/\s+/g, ' ');
    assert.ok(material.includes('@supports (backdrop-filter: blur(1px))'), file);
    assert.ok(material.includes(`:global(:root[data-background='active'][data-glass='frosted']) ${selector}`), file);
    assert.doesNotMatch(css.slice(0, guard), /backdrop-filter:|filter:\s*blur/);
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
    const guard = css.indexOf('@media (prefers-reduced-transparency: no-preference) and (forced-colors: none)');
    assert.ok(guard >= 0, file);
    assert.doesNotMatch(css.slice(0, guard), /\n\s*backdrop-filter:/);
    assert.ok(css.slice(guard).includes("[data-glass='frosted']"), file);
  }
  assert.ok(
    read('src/features/chat/components/Composer.module.css').includes('outline: 2px solid var(--focus-color);'),
  );
});

test('glass ink preserves opaque paint and enables only the guarded transparent panes', () => {
  const ink = read('src/shared/ui/theme/tokens-glass-ink.css');
  assert.ok(ink.includes('@media (prefers-reduced-transparency: no-preference) and (forced-colors: none)'));
  assert.ok(ink.includes('@supports (backdrop-filter: blur(1px))'));
  assert.ok(ink.includes("[data-background='active'][data-glass='frosted'] *"));
  assert.ok(ink.includes('var(--glass-ink-weight, 0%)'));
  for (const [file, selector] of materials.filter(([, selector]) => selector !== '.backdrop')) {
    const css = read(file);
    const guarded = css.slice(css.indexOf('@media (prefers-reduced-transparency: no-preference)'));
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
