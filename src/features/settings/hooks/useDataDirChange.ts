import { useState } from 'react';
import { errorCode, errorMessage } from '@/shared/lib/errors';
import { notifyInfo, reportError } from '@/shared/ui';
import type { DataDirMode } from '@/shared/types/domain';
import { tStorage as t } from '../i18n/storage';
import { changeDataDir } from '../store';

/**
 * 保存先の変更（成功するとアプリが再起動する）。
 * copy で移動先にデータがあれば（conflict）、そのメッセージを見せて「その場所のデータを開く」に切り替えて提案する。
 */
export function useDataDirChange(path: string) {
  const [mode, setMode] = useState<DataDirMode>('copy');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const choose = (next: DataDirMode) => {
    setMode(next);
    setError(null);
  };

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await changeDataDir(path, mode);
      notifyInfo(t('changedRestarting'));
    } catch (reason) {
      const code = errorCode(reason);
      if (code === 'conflict') setMode('open');
      if (code === 'conflict' || code === 'validation') setError(errorMessage(reason));
      else reportError(reason);
    } finally {
      setBusy(false);
    }
  };

  return { mode, choose, busy, error, submit };
}
