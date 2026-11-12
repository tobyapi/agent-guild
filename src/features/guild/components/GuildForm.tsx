import { CREST_COLORS, CREST_SHAPES } from '@/shared/lib/guild';
import { Button, Crest, TextField } from '@/shared/ui';
import type { CrestColor, CrestShape } from '@/shared/types/domain';
import { useGuildForm } from '../hooks/useGuildForm';
import { t } from '../i18n';
import { CrestChoices } from './CrestChoices';
import styles from './GuildForm.module.css';

const SHAPE_NAMES = {
  diamond: 'shapeDiamond',
  shield: 'shapeShield',
  circle: 'shapeCircle',
  hexagon: 'shapeHexagon',
  star: 'shapeStar',
} as const satisfies Record<CrestShape, string>;

const COLOR_NAMES = {
  default: 'colorDefault',
  gold: 'colorGold',
  crimson: 'colorCrimson',
  jade: 'colorJade',
  azure: 'colorAzure',
  violet: 'colorViolet',
} as const satisfies Record<CrestColor, string>;

/** ギルドの名前と紋（形・色）の編集。設定ダイアログの先頭に置く */
export function GuildForm() {
  const form = useGuildForm();
  const { draft, errors } = form;
  const { shape, color } = draft.crest;
  return (
    <form className={styles.form} onSubmit={form.onSubmit} noValidate>
      <div className={styles.identity}>
        <span className={styles.emblem}>
          <Crest size="lg" shape={shape} color={color} />
        </span>
        <div className={styles.fields}>
          <TextField
            label={t('name')}
            hint={t('nameHint', { name: t('defaultName') })}
            placeholder={t('defaultName')}
            value={draft.name}
            onChange={form.setName}
            onBlur={form.touchName}
            error={errors.name}
            maxLength={64}
            autoComplete="off"
            data-autofocus
          />
        </div>
      </div>
      <CrestChoices
        label={t('shape')}
        options={CREST_SHAPES}
        value={shape}
        onChange={(next) => form.setCrest({ shape: next })}
        name={(option) => t(SHAPE_NAMES[option])}
        preview={(option) => <Crest shape={option} color={color} className={styles.preview} />}
      />
      <CrestChoices
        label={t('color')}
        options={CREST_COLORS}
        value={color}
        onChange={(next) => form.setCrest({ color: next })}
        name={(option) => t(COLOR_NAMES[option])}
        preview={(option) => <Crest shape={shape} color={option} className={styles.preview} />}
      />
      <div className={styles.actions}>
        <Button type="submit" variant="primary" disabled={form.saving}>
          {form.saving ? t('saving') : t('save')}
        </Button>
      </div>
    </form>
  );
}
