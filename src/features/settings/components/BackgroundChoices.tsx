import type { KeyboardEvent } from 'react';
import { Button, Icon } from '@/shared/ui';
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
  const preference = useAppearanceStore((s) => s.preference);
  const override = preference.backgroundOverride;
  const custom = preference.themeId !== 'guild';
  const choices = [
    ...(custom ? [{ id: 'default', label: t('backgroundDefault'), image: null }] : []),
    { id: 'none', label: t('backgroundNone'), image: null },
    ...ids.map((id, i) => ({ id, label: t('backgroundImage') + ' ' + (i + 1), image: i + 1 })),
  ];
  const selected = custom && override === null ? 'default' : override?.kind === 'image' ? override.assetId : 'none';
  const firstTab = choices.some((item) => item.id === selected) ? selected : 'none';
  function select(id: string) {
    setBackground(id === 'default' ? null : id === 'none' ? { kind: 'none' } : { kind: 'image', assetId: id });
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
    select(choices[next]!.id);
    const buttons = event.currentTarget
      .closest('[role="radiogroup"]')
      ?.querySelectorAll<HTMLButtonElement>('[role="radio"]');
    buttons?.[next]?.focus();
  }
  return (
    <div className={styles.cards} role="radiogroup" aria-label={t('backgroundLabel')}>
      {choices.map(({ id, label, image }, index) => {
        const checked = id === selected;
        return (
          <div key={id} className={styles.card}>
            <button
              type="button"
              role="radio"
              className={styles.choice}
              aria-checked={checked}
              tabIndex={id === firstTab ? 0 : -1}
              onClick={() => select(id)}
              onKeyDown={(event) => navigate(event, index)}
            >
              {image ? (
                <Thumbnail id={id} scheme={scheme} />
              ) : (
                <span className={styles.emptyPreview}>
                  <Icon name={id === 'none' ? 'minus' : 'image'} />
                </span>
              )}
              <span>{label}</span>
              {checked && <Icon name="check" className={styles.selectedMark} />}
            </button>
            {image && (
              <Button
                variant="danger"
                disabled={busy}
                onClick={() => setRemoving(id)}
                aria-label={t('backgroundDeleteLabel', { label })}
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
