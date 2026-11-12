import type { CSSProperties, KeyboardEvent } from 'react';
import { useAccentStore, setAccent } from '../accentStore';
import { tAppearance } from '../i18n/appearance';
import { ACCENTS, accentName } from '../model/accent';
import styles from './AccentPicker.module.css';

const STEPS: Readonly<Record<string, number>> = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };

/** 矢印キーで隣の色へ移り、選ぶ（ラジオグループのキーボード操作） */
function handleArrows(event: KeyboardEvent<HTMLButtonElement>, index: number) {
  const step = STEPS[event.key];
  if (step === undefined) return;
  event.preventDefault();
  const next = (index + step + ACCENTS.length) % ACCENTS.length;
  const accent = ACCENTS[next];
  if (!accent) return;
  setAccent(accent);
  event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="radio"]')[next]?.focus();
}

/** アクセントの色: 見本（それぞれの塗り）から選ぶ。選ぶとすぐ画面全体に反映する */
export function AccentPicker() {
  const current = useAccentStore((state) => state.accent);
  const label = tAppearance('accentLabel');
  return (
    <div className={styles.field}>
      <span className={styles.label} aria-hidden="true">
        {label}
      </span>
      <div className={styles.swatches} role="radiogroup" aria-label={label}>
        {ACCENTS.map((accent, index) => (
          <button
            key={accent}
            type="button"
            role="radio"
            className={styles.swatch}
            style={{ '--swatch-color': `var(--accent-swatch-${accent})` } as CSSProperties}
            title={accentName(accent)}
            aria-label={accentName(accent)}
            aria-checked={accent === current}
            tabIndex={accent === current ? 0 : -1}
            onClick={() => setAccent(accent)}
            onKeyDown={(event) => handleArrows(event, index)}
          />
        ))}
      </div>
    </div>
  );
}
