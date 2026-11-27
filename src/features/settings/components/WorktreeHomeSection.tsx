import { useEffect, useState } from 'react';
import { errorMessage } from '@/shared/lib/errors';
import { isAbsolutePath } from '@/shared/lib/paths';
import type { WorktreeHome } from '@/shared/types/domain';
import { Button, FormAlert, TextField } from '@/shared/ui';
import { settingsApi } from '../api';
import { tWorktreeHome as t } from '../i18n/worktreeHome';
import { chooseFolder } from '../store';
import styles from './SettingsDialog.module.css';

/** git worktree の置き場: 空欄なら <データフォルダ>/worktrees。保存した次の実行から AI に伝える */
export function WorktreeHomeSection() {
  const { home, text, setText, busy, failure, save, choose } = useWorktreeHome();
  const trimmed = text.trim();
  const invalid = trimmed !== '' && !isAbsolutePath(trimmed);
  const locked = home === null || busy;
  return (
    <>
      <TextField
        label={t('label')}
        hint={t('hint')}
        value={text}
        onChange={setText}
        placeholder={home?.defaultPath}
        disabled={locked}
        error={invalid ? t('notAbsolute') : undefined}
      />
      {home && (
        <div className={styles.location}>
          <span className={styles.locationLabel}>{t('current')}</span>
          <code className={styles.path}>{home.path ?? home.defaultPath}</code>
        </div>
      )}
      <p className={styles.help}>{t('backupNote')}</p>
      <p className={styles.help}>{t('repairNote')}</p>
      {failure && <FormAlert>{failure}</FormAlert>}
      <div>
        <Button variant="ghost" disabled={locked} onClick={choose}>
          {t('choose')}
        </Button>
        <Button disabled={locked || invalid || trimmed === (home?.path ?? '')} onClick={() => void save()}>
          {t('save')}
        </Button>
      </div>
    </>
  );
}

/** 置き場の読み込み・入力・保存（空欄は既定に戻す） */
function useWorktreeHome() {
  const [home, setHome] = useState<WorktreeHome | null>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    void settingsApi.getWorktreeHome().then(
      (value) => {
        if (!active) return;
        setHome(value);
        setText(value.path ?? '');
      },
      () => {
        if (active) setFailure(t('failed'));
      },
    );
    return () => {
      active = false;
    };
  }, []);
  const save = async () => {
    if (!home) return;
    const path = text.trim() || null;
    setBusy(true);
    setFailure(null);
    try {
      await settingsApi.setWorktreeHome(path);
      setHome({ ...home, path });
      setText(path ?? '');
    } catch (error) {
      setFailure(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };
  const choose = () => {
    chooseFolder().then(
      (path) => path !== null && setText(path),
      (error) => setFailure(errorMessage(error)),
    );
  };
  return { home, text, setText, busy, failure, save, choose };
}
