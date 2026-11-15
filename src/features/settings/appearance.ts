import { useStore } from 'zustand';
import type { AppearancePreference, BackgroundSpec, MotionPreference, SchemePreference } from '@/shared/theme/types';
import { createAppearanceStore } from './appearanceStore';
import type { Accent } from './model/accent';

const controller = createAppearanceStore();

export function setBackground(backgroundOverride: BackgroundSpec | null): void {
  controller.setPreference({ ...controller.store.getState().preference, backgroundOverride });
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

export function setThemePreference(schemePreference: SchemePreference): void {
  controller.setPreference({ ...controller.store.getState().preference, schemePreference });
}

export function setAccent(accent: Accent): void {
  controller.setPreference({
    ...controller.store.getState().preference,
    accentOverride: accent === 'default' ? null : accent,
  });
}
