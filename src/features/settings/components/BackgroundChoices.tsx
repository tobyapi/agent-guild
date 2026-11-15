import type { KeyboardEvent } from 'react';
import { Button } from '@/shared/ui';
import type { Scheme } from '@/shared/theme/types';
import { setBackground, useAppearanceStore } from '../appearance';
import { useBackgroundImage } from '../useBackgroundImage';
import { tAppearance as t } from '../i18n/appearance';
import styles from './ThemePicker.module.css';

function Thumbnail({ id, scheme }: { id: string; scheme: Scheme }) {
  const url = useBackgroundImage(id);
  return (
    <span
      className={styles.preview}
      data-scheme={scheme}
      style={url ? { backgroundImage: `url("${url}")` } : undefined}
    />
  );
}

interface Props {
  ids: string[];
  scheme: Scheme;
  busy: boolean;
  setRemoving: (id: string) => void;
}
export function BackgroundChoices({ ids, scheme, busy, setRemoving }: Props) {
  const selected = useAppearanceStore((s) => s.preference.backgroundOverride);
  const choices = [null, ...ids];
  function select(id: string | null) {
    setBackground(id ? { kind: 'image', assetId: id } : { kind: 'none' });
  }
  function navigate(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const steps: Record<string, number> = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 };
    const step = steps[event.key];
    if (step === undefined && event.key !== 'Home' && event.key !== 'End') return;
    event.preventDefault();
    const next =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? choices.length - 1
          : (index + step! + choices.length) % choices.length;
    select(choices[next]!);
    const buttons = event.currentTarget
      .closest('[role="radiogroup"]')
      ?.querySelectorAll<HTMLButtonElement>('[role="radio"]');
    buttons?.[next]?.focus();
  }
  return (
    <div className={styles.cards} role="radiogroup" aria-label={t('backgroundLabel')}>
      {choices.map((id, index) => {
        const checked = id ? selected?.kind === 'image' && selected.assetId === id : selected?.kind !== 'image';
        return (
          <div key={id ?? 'none'} className={styles.imageRow}>
            <button
              type="button"
              role="radio"
              className={styles.card}
              aria-checked={checked}
              tabIndex={checked ? 0 : -1}
              onClick={() => select(id)}
              onKeyDown={(event) => navigate(event, index)}
            >
              {id ? <Thumbnail id={id} scheme={scheme} /> : <span className={styles.preview} data-scheme={scheme} />}
              <span>{id ? `${t('backgroundImage')} ${index}` : t('backgroundNone')}</span>
            </button>
            {id && (
              <Button
                variant="danger"
                disabled={busy}
                onClick={() => setRemoving(id)}
                aria-label={`${t('backgroundDelete')} ${index}`}
              >
                {t('backgroundDelete')}
              </Button>
            )}
          </div>
        );
      })}
    </div>
  );
}
