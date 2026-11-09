// スキルライブラリ（設定で指定したフォルダと、そこで見つかったスキル）。画面を開いたとき・「再読み込み」・
// skill-library-changed で取り直す（フォルダの中身の変化は監視しない。docs/design.md §14）。
import { create } from 'zustand';
import { reportError } from '@/shared/ui';
import type { SkillLibrary } from '@/shared/types/domain';
import { skillsApi } from './api';

interface LibraryStoreState {
  /** まだ取得していなければ null */
  library: SkillLibrary | null;
  loading: boolean;
}

export const useLibraryStore = create<LibraryStoreState>()(() => ({ library: null, loading: false }));

/** 走査し直す（呼ぶたびにサーバがフォルダを読み直す） */
export async function loadSkillLibrary(): Promise<void> {
  useLibraryStore.setState({ loading: true });
  try {
    useLibraryStore.setState({ library: await skillsApi.library() });
  } finally {
    useLibraryStore.setState({ loading: false });
  }
}

/** skill-library-changed: 取得済みなら取り直す */
export function reloadSkillLibraryIfLoaded(): void {
  if (useLibraryStore.getState().library !== null) loadSkillLibrary().catch(reportError);
}

/** フォルダの指定を保存する（順序も保存される）。結果の走査もすぐ反映する */
export async function setLibraryDirs(dirs: string[]): Promise<void> {
  useLibraryStore.setState({ library: await skillsApi.setLibraryDirs(dirs) });
}

/** OS のフォルダ選択（取り消したら null） */
export async function chooseLibraryFolder(): Promise<string | null> {
  return skillsApi.chooseFolder();
}
