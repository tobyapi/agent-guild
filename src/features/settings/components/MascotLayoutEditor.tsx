import { Button } from '@/shared/ui';
import { currentLanguage } from '@/shared/i18n';
import { DEFAULT_MASCOT_LAYOUT, MASCOT_SIZE_MAX, MASCOT_SIZE_MIN, type MascotPlacement } from '@/shared/theme/mascot';
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
  const draft = useMascotDrag(layout, setMascotLayout);
  return (
    <div className={styles.group}>
      <MascotScene
        avatar={avatar}
        layout={draft.layout}
        scheme={scheme}
        running={0}
        pending={0}
        dragHandlers={draft.handlers}
      />
      <p className={styles.note}>{t('mascotAdjustHint')}</p>
      <div className={styles.layout}>
        <PlacementFields
          title={t('backgroundMascot')}
          placement={draft.layout.mascot}
          update={(mascot) => setMascotLayout({ ...layout, mascot: { ...layout.mascot, ...mascot } })}
        />
        <PlacementFields
          title={t('mascotCard')}
          placement={draft.layout.card}
          update={(card) => setMascotLayout({ ...layout, card: { ...layout.card, ...card } })}
        />
      </div>
      <Button size="sm" className={styles.action} onClick={() => setMascotLayout(DEFAULT_MASCOT_LAYOUT)}>
        {t('mascotResetLayout')}
      </Button>
    </div>
  );
}

function PlacementFields({
  title,
  placement,
  update,
}: {
  title: string;
  placement: MascotPlacement;
  update: (partial: Partial<MascotPlacement>) => void;
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
          />
        </label>
      ))}
    </fieldset>
  );
}
