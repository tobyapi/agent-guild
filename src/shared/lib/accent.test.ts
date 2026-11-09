import { describe, expect, it } from 'vitest';
import { accentStyleText, accentVars } from './accent';

describe('accentVars / accentStyleText', () => {
  it('どの値でも同じ形で CSS 変数を組み立て、トークンがなければ中立（--kind-neutral）に落ちる', () => {
    expect(accentVars('manager')).toEqual({
      '--tag-fg': 'var(--kind-manager, var(--kind-neutral))',
      '--tag-bg': 'var(--kind-manager-soft, var(--kind-neutral-soft))',
    });
    expect(accentStyleText('enduser')).toBe('--tag-fg: var(--kind-enduser, var(--kind-neutral)); --tag-bg: var(--kind-enduser-soft, var(--kind-neutral-soft))');
  });

  it('null やトークン名に使えない値には何も渡さない（中立）', () => {
    expect(accentVars(null)).toBeUndefined();
    expect(accentVars('')).toBeUndefined();
    expect(accentVars('a; color: red')).toBeUndefined();
    expect(accentStyleText('x)')).toBe('');
  });
});
