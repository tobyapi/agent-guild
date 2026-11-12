// アプリの更新: 確認の結果と、確認中・更新中の状態。設定の区画と起動時の知らせが同じ状態を見る。
import { create } from 'zustand';
import { errorMessage } from '@/shared/lib/errors';
import type { UpdateStatus } from '@/shared/types/domain';
import { updateApi } from './api';
import { INITIAL_UPDATE_STATE } from './model/update';
import type { UpdateState } from './model/update';

export const useUpdateStore = create<UpdateState>()(() => INITIAL_UPDATE_STATE);

/**
 * 新しい版があるかを確かめる。確かめられなければ null を返し、理由は error に入る（投げない）。
 * 確認中・更新中に重ねて呼ばれたら、何もせず前の結果を返す。
 */
export async function checkForUpdate(): Promise<UpdateStatus | null> {
  if (useUpdateStore.getState().phase !== 'idle') return useUpdateStore.getState().status;
  useUpdateStore.setState({ phase: 'checking', error: null });
  try {
    const status = await updateApi.check();
    useUpdateStore.setState({ phase: 'idle', status });
    return status;
  } catch (error) {
    useUpdateStore.setState({ phase: 'idle', error: errorMessage(error) });
    return null;
  }
}

/** 新しい版を入れる。うまくいけばアプリが起動し直すので、状態は「更新中」のままにする */
export async function installUpdate(): Promise<void> {
  if (useUpdateStore.getState().phase !== 'idle') return;
  useUpdateStore.setState({ phase: 'installing', error: null });
  try {
    await updateApi.install();
  } catch (error) {
    useUpdateStore.setState({ phase: 'idle', error: errorMessage(error) });
  }
}
