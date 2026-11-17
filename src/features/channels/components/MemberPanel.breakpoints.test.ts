import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';

it('limits the icon-only presentation to the intermediate viewport range', () => {
  const css = readFileSync(new URL('./MemberPanel.compact.css', import.meta.url), 'utf8');
  expect(css).toContain('@media (760px < width <= 1120px)');
  expect(css).toContain('.panel .compactAvatar');
  expect(css).toContain('.panel .compactAdd');
});
