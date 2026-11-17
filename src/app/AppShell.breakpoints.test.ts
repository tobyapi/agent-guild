import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const shellCss = readFileSync(new URL('./AppShell.module.css', import.meta.url), 'utf8');

it('reserves a compact member column through 1120px and hides both panels at 760px', () => {
  const compact = shellCss.split('@media (max-width: 1120px)')[1]?.split('@media (max-width: 760px)')[0];
  expect(compact).toContain('var(--member-panel-compact-width)');
  expect(compact).not.toContain('display: none');
  const mobile = shellCss.split('@media (max-width: 760px)')[1]?.split(':global')[0];
  expect(mobile).toContain('.columns[data-members] > :last-child');
  expect(mobile).toContain('display: none');
});
