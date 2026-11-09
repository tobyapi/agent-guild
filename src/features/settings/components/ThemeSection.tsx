import { Segment } from '@/shared/ui';
import { THEME_CHOICES } from '../model/theme';
import { setThemePreference, useThemeStore } from '../themeStore';

/** テーマ: ダーク / ライト / OS に合わせる（この端末だけの表示の好み） */
export function ThemeSection() {
  const preference = useThemeStore((state) => state.preference);
  return <Segment label="テーマ" value={preference} options={THEME_CHOICES} onChange={setThemePreference} />;
}
