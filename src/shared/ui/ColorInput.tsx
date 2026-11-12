import type { CSSProperties, KeyboardEvent } from 'react';
import { COLOR_PRESETS, colorName } from '@/shared/lib/colors';
import styles from './ColorInput.module.css';
import { t } from './i18n';

export interface ColorInputProps {
  value: string;
  onChange: (color: string) => void;
  /** 人間のプロフィールでは見本を円にする（丸は人、角は AI） */
  human?: boolean;
}

const STEPS: Readonly<Record<string, number>> = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };

/** 矢印キーで隣の色へ移る（ラジオグループのキーボード操作） */
function handleArrows(event: KeyboardEvent<HTMLButtonElement>, index: number, onChange: (color: string) => void) {
  const step = STEPS[event.key];
  if (step === undefined) return;
  event.preventDefault();
  const next = (index + step + COLOR_PRESETS.length) % COLOR_PRESETS.length;
  const preset = COLOR_PRESETS[next];
  if (!preset) return;
  onChange(preset.value);
  event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="radio"]')[next]?.focus();
}

/** 個人色: 12色の見本から選ぶ */
export function ColorInput({ value, onChange, human }: ColorInputProps) {
  const selected = value.toLowerCase();
  const hasSelection = COLOR_PRESETS.some((preset) => preset.value === selected);
  return (
    <div className={styles.field} role="group" aria-label={t('colorLabel')}>
      <span className={styles.label}>{t('colorLabel')}</span>
      <div
        className={styles.swatches}
        role="radiogroup"
        aria-label={t('colorLabel')}
        data-human={human ? '' : undefined}
      >
        {COLOR_PRESETS.map((preset, index) => (
          <button
            key={preset.value}
            type="button"
            role="radio"
            className={styles.swatch}
            style={{ '--swatch-color': preset.value } as CSSProperties}
            title={colorName(preset.key)}
            aria-label={colorName(preset.key)}
            aria-checked={preset.value === selected}
            tabIndex={preset.value === selected || (!hasSelection && index === 0) ? 0 : -1}
            onClick={() => onChange(preset.value)}
            onKeyDown={(event) => handleArrows(event, index, onChange)}
          />
        ))}
      </div>
    </div>
  );
}
