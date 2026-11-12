import { Segment } from '@/shared/ui';
import { t } from '../i18n';
import { themeChoices } from '../model/theme';
import { setThemePreference, useThemeStore } from '../themeStore';
import { AccentPicker } from './AccentPicker';
import styles from './AccentPicker.module.css';

/** 外観: テーマ（ダーク / ライト / OS に合わせる）とアクセントの色（どちらもこの端末だけの表示の好み） */
export function AppearanceSection() {
  const preference = useThemeStore((state) => state.preference);
  return (
    <div className={styles.appearance}>
      <div className={styles.field}>
        <span className={styles.label} aria-hidden="true">
          {t('themeLabel')}
        </span>
        <Segment label={t('themeLabel')} value={preference} options={themeChoices()} onChange={setThemePreference} />
      </div>
      <AccentPicker />
    </div>
  );
}
