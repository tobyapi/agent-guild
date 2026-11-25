import { notifyInfo } from '@/shared/ui';
import { tAppearance } from './i18n/appearance';
import { useStore } from 'zustand';
import { resolveAppearance } from '@/shared/theme/resolve';
import type { BackgroundSpec, SchemePreference } from '@/shared/theme/types';
import { createAppearanceStore } from './appearanceStore';
import type { MascotLayout, MascotSource } from '@/shared/theme/mascot';
import { isBackgroundAssetId } from '@/shared/theme/backgrounds';
import type { Accent } from './model/accent';
import { settingsApi } from './api';

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

export function setMascotEnabled(enabled: boolean): boolean {
  return controller.setMascot({ ...controller.store.getState().mascot, enabled });
}

export function setMascotLayout(layout: MascotLayout): boolean {
  return controller.setMascot({ ...controller.store.getState().mascot, layout });
}

export function setMascotSource(source: MascotSource): boolean {
  return controller.setMascot({ ...controller.store.getState().mascot, source });
}

export async function deleteGeneratedMascot(id: string): Promise<void> {
  if (!isBackgroundAssetId(id)) throw new Error('Invalid mascot image ID');
  const { mascot, readOnly } = controller.store.getState();
  if (readOnly) throw new Error('Appearance settings are read-only');
  const selected = mascot.source.kind === 'generated' && mascot.source.id === id;
  const cleared = { ...mascot, enabled: false, source: { kind: 'default' } as const };
  // Save the selection first so interruption or storage failure cannot leave a deleted image selected.
  if (selected && !controller.setMascot(cleared)) throw new Error('Cannot save mascot settings');
  try {
    await settingsApi.deleteMascot(id);
  } catch (error) {
    // Restore the selection only if it was not changed while deletion was pending.
    if (selected && controller.store.getState().mascot === cleared) controller.setMascot(mascot);
    throw error;
  }
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
