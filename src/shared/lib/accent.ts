// 役割の色（テンプレートの accent）を CSS 変数で組み立てる（docs/design.md §2・docs/ui-design.md §2）。
// 値で分岐しない: accent が 'manager' なら var(--kind-manager, var(--kind-neutral)) を作って --tag-fg / --tag-bg に渡すだけ。
// CSS 側は color: var(--tag-fg, var(--kind-neutral)); background: var(--tag-bg, var(--kind-neutral-soft)) だけを書く。

/** トークン名に使える値（英数字とハイフン）。それ以外（null を含む）は色を付けない */
const TOKEN_NAME = /^[a-z0-9-]+$/i;

export interface AccentVars {
  '--tag-fg': string;
  '--tag-bg': string;
}

/** 札・印・チップに渡す CSS 変数。色が決まらなければ undefined（何も渡さず中立にする） */
export function accentVars(accent: string | null | undefined): AccentVars | undefined {
  if (!accent || !TOKEN_NAME.test(accent)) return undefined;
  return {
    '--tag-fg': `var(--kind-${accent}, var(--kind-neutral))`,
    '--tag-bg': `var(--kind-${accent}-soft, var(--kind-neutral-soft))`,
  };
}

/** HTML の style 属性に書く形（メンションのチップ）。色が決まらなければ空文字 */
export function accentStyleText(accent: string | null | undefined): string {
  const vars = accentVars(accent);
  return vars ? `--tag-fg: ${vars['--tag-fg']}; --tag-bg: ${vars['--tag-bg']}` : '';
}
