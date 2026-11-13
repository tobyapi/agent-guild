// 新しい版を自動で確かめるかの好みの保持。保存先は localStorage（使えない環境では保存せずにこの起動のあいだだけ効く）。
import { create } from 'zustand';
import { AUTO_CHECK_STORAGE_KEY, parseAutoCheck, serializeAutoCheck } from './model/autoCheck';

export const useAutoCheckStore = create<{ enabled: boolean }>()(() => ({
  enabled: parseAutoCheck(readStored()),
}));

function readStored(): string | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage.getItem(AUTO_CHECK_STORAGE_KEY);
  } catch {
    return null;
  }
}

/** 自動で確かめる設定がオンか（起動時の知らせと設定の区画が見る） */
export function useAutoCheckEnabled(): boolean {
  return useAutoCheckStore((state) => state.enabled);
}

export function setAutoCheck(enabled: boolean): void {
  useAutoCheckStore.setState({ enabled });
  try {
    localStorage.setItem(AUTO_CHECK_STORAGE_KEY, serializeAutoCheck(enabled));
  } catch {
    // 保存できなくても、この起動のあいだは効いている
  }
}
