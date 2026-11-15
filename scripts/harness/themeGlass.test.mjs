import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
const materials = [
  ['src/shared/ui/theme/ThemeBackdrop.module.css', '.backdrop'],
  ['src/app/AppShell.module.css', '.main'],
  ['src/app/Sidebar.module.css', '.sidebar'],
  ['src/features/channels/components/MemberPanel.module.css', '.panel'],
  ['src/features/channels/components/ChannelHeader.module.css', '.header'],
  ['src/features/chat/components/MessageList.module.css', '.frame'],
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
    const material = css.slice(guard);
    assert.ok(material.includes('@supports (backdrop-filter: blur(1px))'), file);
    assert.ok(material.includes(`:global(:root[data-background='active']) ${selector}`), file);
    assert.doesNotMatch(css.slice(0, guard), /backdrop-filter:|filter:\s*blur/);
  }
});

test('the entire reading column is protected and expensive filters never scale with messages', () => {
  const css = read('src/features/chat/components/MessageList.module.css');
  assert.ok(css.includes('inline-size: min(100%, var(--glass-reading-width));'));
  assert.ok(css.includes('var(--surface-chat) max(0px, calc((100% - var(--glass-reading-width)) / 2))'));
  assert.ok(css.includes('var(--surface-chat) min(100%, calc((100% + var(--glass-reading-width)) / 2))'));
  assert.doesNotMatch(read('src/features/chat/components/Message.module.css'), /(?:^|\n)\s*backdrop-filter:/);
  assert.ok(
    read('src/features/chat/components/MessageItem.tsx').includes("data-human={author.human ? '' : undefined}"),
  );
  assert.ok(read('src/features/chat/components/ActivityBar.module.css').includes('background: var(--surface-chat);'));
});

test('glass cards retain AA for all ordinary token colors even over arbitrary blurred RGB', () => {
  const tokens = read('src/shared/ui/theme/tokens-glass.css');
  const alpha = Number(tokens.match(/--glass-card-weight:\s*(\d+)%/)[1]) / 100;
  const fixture = JSON.parse(read('contracts/behavior/theme-backdrop-token-table.json'));
  const luminance = (rgb) =>
    rgb.reduce(
      (sum, c, i) => sum + [0.2126, 0.7152, 0.0722][i] * (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4),
      0,
    );
  for (const unit of fixture.units) {
    const colors = read(`src/shared/ui/theme/${unit.scheme === 'dark' ? 'tokens.css' : 'tokens-light.css'}`);
    for (const name of ['input', 'elevated', 'app']) {
      const hex = colors.match(new RegExp(`--bg-${name}:\\s*#([a-f0-9]{6})`))[1];
      const surface = hex.match(/../g).map((part) => parseInt(part, 16) / 255);
      const low = surface.map((c) => Math.max(0, c * alpha - 0.5 / 255));
      const high = surface.map((c) => Math.min(1, c * alpha + 1 - alpha + 0.5 / 255));
      for (const row of unit.rows.filter((r) => r.status === 'resolved' && r.overlays.length === 0)) {
        assert.equal(row.text.alpha, 1);
        const ink = row.text.rgb;
        const fgLow = luminance(ink.map((c) => Math.max(0, c - 0.5 / 255)));
        const fgHigh = luminance(ink.map((c) => Math.min(1, c + 0.5 / 255)));
        const bgLow = luminance(low);
        const bgHigh = luminance(high);
        const ratio = fgLow > bgHigh ? (fgLow + 0.05) / (bgHigh + 0.05) : (bgLow + 0.05) / (fgHigh + 0.05);
        assert.ok(ratio >= 4.6, `${unit.name}/${name}/${row.name}: ${ratio}`);
      }
    }
  }
});
