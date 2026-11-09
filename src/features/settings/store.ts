// 設定ダイアログの開閉と、データの保存先の情報。
import { create } from 'zustand';
import type { DataDirMode, StorageInfo } from '@/shared/types/domain';
import { settingsApi } from './api';

/** 開いたときに見せる区画（ほかの画面から案内するとき） */
export type SettingsSection = 'skillLibrary';

interface SettingsStoreState {
  open: boolean;
  focus: SettingsSection | null;
  storage: StorageInfo | null;
}

export const useSettingsStore = create<SettingsStoreState>()(() => ({ open: false, focus: null, storage: null }));

export function openSettings(focus: SettingsSection | null = null): void {
  useSettingsStore.setState({ open: true, focus });
}

export function closeSettings(): void {
  useSettingsStore.setState({ open: false, focus: null });
}

export async function loadStorageInfo(): Promise<void> {
  useSettingsStore.setState({ storage: await settingsApi.storageInfo() });
}

/** OS のフォルダ選択（取り消したら null） */
export async function chooseFolder(): Promise<string | null> {
  return settingsApi.chooseFolder();
}

export async function changeDataDir(path: string, mode: DataDirMode): Promise<void> {
  await settingsApi.changeDataDir(path, mode);
}

export async function revealDataDir(): Promise<void> {
  await settingsApi.revealDataDir();
}
