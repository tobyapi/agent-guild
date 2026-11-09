import { useEffect, useState } from 'react';
import { errorCode, errorMessage } from '@/shared/lib/errors';
import { isSamePath } from '@/shared/lib/paths';
import { notifyInfo, reportError } from '@/shared/ui';
import type { BootStatus, StorageInfo } from '@/shared/types/domain';
import { recoveryApi } from '../api';
import type { RecoveryAction } from '../model/reasons';

/** 復旧画面の操作（再試行・別のフォルダを選ぶ・既定の場所に戻す・フォルダを開く） */
export function useRecovery(boot: BootStatus) {
  const [storage, setStorage] = useState<StorageInfo | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    recoveryApi.storageInfo().then(setStorage, reportError);
  }, []);

  const atDefault = storage !== null && isSamePath(boot.dataDir, storage.defaultDataDir);

  /** task が true を返したら再起動に向かう。失敗はボタンの下のエラーの帯に出す */
  const attempt = async (task: () => Promise<boolean>) => {
    setBusy(true);
    setError(null);
    try {
      if (await task()) notifyInfo('再起動します…');
    } catch (reason) {
      if (errorCode(reason) === null) reportError(reason);
      else setError(errorMessage(reason));
    } finally {
      setBusy(false);
    }
  };

  const restart = async () => {
    await recoveryApi.restartApp();
    return true;
  };

  /** フォルダの選択を取り消したら何もしない */
  const chooseAndOpen = async () => {
    const path = await recoveryApi.chooseFolder();
    if (path === null) return false;
    await recoveryApi.openDataDir(path);
    return true;
  };

  const openDefault = async () => {
    if (!storage) return false;
    await recoveryApi.openDataDir(storage.defaultDataDir);
    return true;
  };

  const run = (action: RecoveryAction) => {
    const tasks: Record<RecoveryAction, () => Promise<boolean>> = {
      retry: restart,
      choose: chooseAndOpen,
      useDefault: openDefault,
    };
    void attempt(tasks[action]);
  };

  const reveal = () => void recoveryApi.revealDataDir().catch(reportError);

  return { atDefault, busy, error, run, reveal };
}
