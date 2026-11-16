import assert from 'node:assert/strict';

export const support = '@supports (backdrop-filter: blur(1px))';
export const fallback = '@media (prefers-reduced-transparency: reduce), (forced-colors: active)';

// Extract a complete block so declarations in adjacent rules cannot satisfy the check.
export function block(css, marker) {
  const start = css.indexOf(marker);
  assert.ok(start >= 0, `Missing ${marker}`);
  const open = css.indexOf('{', start + marker.length);
  assert.ok(open >= 0, `Missing block for ${marker}`);
  let depth = 1;
  for (let end = open + 1; end < css.length; end++) {
    if (css[end] === '{') depth++;
    if (css[end] === '}' && --depth === 0) return css.slice(open + 1, end);
  }
  assert.fail(`Unclosed block for ${marker}`);
}
