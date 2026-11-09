// 設定ダイアログ・初回起動の初期設定のダイアログの開閉と、データの保存先の情報。
import { create } from 'zustand';
import type { DataDirMode, StorageInfo } from '@/shared/types/domain';
import { settingsApi } from './api';

/** 開いたときに見せる区画（ほかの画面から案内するとき） */
export type SettingsSection = 'skillLibrary';

interface SettingsStoreState {
  open: boolean;
  focus: SettingsSection | null;
  storage: StorageInfo | null;
  /** 初回起動の初期設定のダイアログ（起動時に BootStatus.needsSetup なら開く） */
  setupOpen: boolean;
}

export const useSettingsStore = create<SettingsStoreState>()(() => ({
  open: false,
  focus: null,
  storage: null,
  setupOpen: false,
}));

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

export function openSetup(): void {
  useSettingsStore.setState({ setupOpen: true });
}

export function closeSetup(): void {
  useSettingsStore.setState({ setupOpen: false });
}

/** 初期設定を終えた印を保存する（次の起動からダイアログを出さない） */
export async function completeSetup(): Promise<void> {
  await settingsApi.completeSetup();
}
