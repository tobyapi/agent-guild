import { notifyInfo } from '@/shared/ui';
import { tAppearance } from './i18n/appearance';
import { useStore } from 'zustand';
import { resolveAppearance } from '@/shared/theme/resolve';
import type { BackgroundSpec, SchemePreference } from '@/shared/theme/types';
import { createAppearanceStore } from './appearanceStore';
import type { Accent } from './model/accent';

const controller = createAppearanceStore();
export function missingBackground(id: string) {
  const state = controller.store.getState();
  const background = resolveAppearance(state.active, state.registry, 'dark').backgroundOverride;
  if (background.kind !== 'image' || background.assetId !== id) return;
  if (state.active.themeId === 'guild') setBackground({ kind: 'none' });
  else controller.missingImage(id);
}

export function setSchemePreference(schemePreference: SchemePreference): void {
  controller.setPreference({ ...controller.store.getState().preference, schemePreference });
}

export function setBackground(backgroundOverride: BackgroundSpec | null): void {
  controller.setPreference({ ...controller.store.getState().preference, backgroundOverride });
}

/** 初回描画前に保存値を反映する。返す関数は監視の解除用。 */
export function initAppearance(): () => void {
  controller.init();
  if (controller.store.getState().readOnly) notifyInfo(tAppearance('newerTheme'));
  return () => controller.dispose();
}

export const themeActions = {
  save: controller.saveTheme,
  select: (id: string) => controller.select(id),
  remove: (id: string) => controller.remove(id),
  undo: () => controller.undo(),
};
export function useAppearanceStore<T>(selector: (state: ReturnType<typeof controller.store.getState>) => T): T {
  return useStore(controller.store, selector);
}

export function setAccent(accent: Accent): void {
  controller.setPreference({
    ...controller.store.getState().preference,
    accentOverride: accent === 'default' ? null : accent,
  });
}
