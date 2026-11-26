import { useState } from 'react';
import { Button } from '@/shared/ui';
import { currentLanguage } from '@/shared/i18n';
import {
  DEFAULT_MASCOT_LAYOUT,
  MASCOT_SIZE_MAX,
  MASCOT_SIZE_MIN,
  type MascotLayout,
  type MascotPlacement,
} from '@/shared/theme/mascot';
import type { Scheme } from '@/shared/theme/types';
import { setMascotLayout, useAppearanceStore } from '../appearance';
import { tAppearance as t } from '../i18n/appearance';
import { useMascotAvatar } from '../useMascotAvatar';
import { MascotScene } from './MascotScene';
import { useMascotDrag } from './useMascotDrag';
import styles from './MascotControls.module.css';

const axes = [
  { key: 'x', label: 'mascotHorizontal', min: 0, max: 100 },
  { key: 'y', label: 'mascotVertical', min: 0, max: 100 },
  { key: 'size', label: 'mascotSize', min: MASCOT_SIZE_MIN, max: MASCOT_SIZE_MAX },
] as const;

export function MascotLayoutEditor({ scheme }: { scheme: Scheme }) {
  const { source, layout } = useAppearanceStore((state) => state.mascot);
  const avatar = useMascotAvatar(source);
  const [sliderDraft, setSliderDraft] = useState<MascotLayout | null>(null);
  const editing = sliderDraft ?? layout;
  const drag = useMascotDrag(editing, save);

  function update(item: keyof MascotLayout, partial: Partial<MascotPlacement>) {
    setSliderDraft((current) => {
      const next = current ?? layout;
      return { ...next, [item]: { ...next[item], ...partial } };
    });
  }

  function save(next: MascotLayout) {
    if (setMascotLayout(next)) setSliderDraft(null);
  }

  function commitSlider() {
    if (sliderDraft) save(sliderDraft);
  }

  return (
    <div className={styles.group}>
      <MascotScene
        avatar={avatar}
        fullBody={source.kind === 'preset' && source.fullBody}
        layout={drag.layout}
        scheme={scheme}
        running={0}
        pending={0}
        dragHandlers={drag.handlers}
      />
      <p className={styles.note}>{t('mascotAdjustHint')}</p>
      <div className={styles.layout}>
        <PlacementFields
          title={t('backgroundMascot')}
          placement={drag.layout.mascot}
          update={(mascot) => update('mascot', mascot)}
          commit={commitSlider}
        />
        <PlacementFields
          title={t('mascotCard')}
          placement={drag.layout.card}
          update={(card) => update('card', card)}
          commit={commitSlider}
        />
      </div>
      <Button size="sm" className={styles.action} onClick={() => save(DEFAULT_MASCOT_LAYOUT)}>
        {t('mascotResetLayout')}
      </Button>
    </div>
  );
}

function PlacementFields({
  title,
  placement,
  update,
  commit,
}: {
  title: string;
  placement: MascotPlacement;
  update: (partial: Partial<MascotPlacement>) => void;
  commit: () => void;
}) {
  return (
    <fieldset className={styles.placement}>
      <legend>{title}</legend>
      {axes.map(({ key, label, min, max }) => (
        <label key={key} className={styles.range}>
          <span>{t(label)}</span>
          <input
            type="range"
            min={min}
            max={max}
            value={placement[key]}
            aria-valuetext={new Intl.NumberFormat(currentLanguage(), { style: 'percent' }).format(placement[key] / 100)}
            onChange={(event) => update({ [key]: event.currentTarget.valueAsNumber })}
            onPointerUp={commit}
            onPointerCancel={commit}
            onKeyUp={commit}
            onBlur={commit}
          />
        </label>
      ))}
    </fieldset>
  );
}
