import { useEffect, useState } from 'react';
import { isSamePath } from '@/shared/lib/paths';
import { Button, Icon, notifyInfo, reportError } from '@/shared/ui';
import { tStorage as t } from '../i18n/storage';
import { storageSourceText } from '../model/storage';
import { chooseFolder, loadStorageInfo, revealDataDir, useSettingsStore } from '../store';
import { DataDirDialog } from './DataDirDialog';
import styles from './SettingsDialog.module.css';

/** データの保存先: いまの場所・フォルダを開く・変更…（選んだら確認ダイアログ） */
export function StorageSection() {
  const storage = useSettingsStore((state) => state.storage);
  const [candidate, setCandidate] = useState<string | null>(null);

  useEffect(() => {
    loadStorageInfo().catch(reportError);
  }, []);

  const choose = () => {
    chooseFolder().then((path) => {
      if (path === null) return;
      if (storage && isSamePath(path, storage.dataDir)) notifyInfo(t('sameFolder'));
      else setCandidate(path);
    }, reportError);
  };

  if (!storage) return <p className={styles.help}>{t('loading')}</p>;
  return (
    <>
      <div className={styles.location}>
        <span className={styles.locationLabel}>{t('currentLocation')}</span>
        <code className={styles.path}>{storage.dataDir}</code>
        <Button size="sm" variant="ghost" onClick={() => void revealDataDir().catch(reportError)}>
          <Icon name="folder" />
          {t('openFolder')}
        </Button>
      </div>
      <p className={styles.help}>{storageSourceText(storage)}</p>
      <div>
        <Button onClick={choose} disabled={storage.source === 'env'}>
          {t('change')}
        </Button>
      </div>
      {candidate && <DataDirDialog path={candidate} onClose={() => setCandidate(null)} />}
    </>
  );
}
