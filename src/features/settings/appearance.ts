import { selectThemeCard } from '@/shared/theme/catalog';
import type { ThemeCard } from '@/shared/theme/catalog';
import { useStore } from 'zustand';
import type { AppearancePreference, MotionPreference } from '@/shared/theme/types';
import { createAppearanceStore } from './appearanceStore';
import type { Accent } from './model/accent';

const controller = createAppearanceStore();

export function setThemeCard(card: ThemeCard): void {
  controller.setPreference(selectThemeCard(controller.store.getState().preference, card));
}

export function setMotionPreference(motionPreference: MotionPreference): void {
  controller.setPreference({ ...controller.store.getState().preference, motionPreference });
}

/** 初回描画前に保存値を反映する。返す関数は監視の解除用。 */
export function initAppearance(): () => void {
  controller.init();
  return () => controller.dispose();
}

export function useAppearanceStore<T>(selector: (state: { preference: AppearancePreference }) => T): T {
  return useStore(controller.store, selector);
}

export function setAccent(accent: Accent): void {
  controller.setPreference({
    ...controller.store.getState().preference,
    accentOverride: accent === 'default' ? null : accent,
  });
}
