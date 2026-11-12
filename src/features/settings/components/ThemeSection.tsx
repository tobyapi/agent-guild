import { Segment } from '@/shared/ui';
import { t } from '../i18n';
import { themeChoices } from '../model/theme';
import { setThemePreference, useThemeStore } from '../themeStore';

/** テーマ: ダーク / ライト / OS に合わせる（この端末だけの表示の好み） */
export function ThemeSection() {
  const preference = useThemeStore((state) => state.preference);
  return <Segment label={t('themeLabel')} value={preference} options={themeChoices()} onChange={setThemePreference} />;
}
