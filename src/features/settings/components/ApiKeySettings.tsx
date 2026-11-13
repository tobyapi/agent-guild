import { useEffect, useState } from 'react';
import type { BackendInfo } from '@/shared/types/domain';
import { Button, TextField } from '@/shared/ui';
import { settingsApi } from '../api';
import { tBackends as t } from '../i18n/backends';
import styles from './SettingsDialog.module.css';

type KeyStatus = { source: 'saved' | 'environment' | 'unset'; supported: boolean };
const SOURCE_KEYS = { saved: 'keySaved', environment: 'keyEnvironment', unset: 'keyUnset' } as const;

function parseStatus(text: string): KeyStatus {
  const value: unknown = JSON.parse(text);
  if (
    typeof value !== 'object' ||
    value === null ||
    !('source' in value) ||
    !('supported' in value) ||
    typeof value.supported !== 'boolean' ||
    !['saved', 'environment', 'unset'].includes(String(value.source))
  ) {
    throw new Error('Invalid credential status');
  }
  return value as KeyStatus;
}

function useApiKeySettings(backendId: string) {
  const [key, setKey] = useState('');
  const [status, setStatus] = useState<KeyStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  useEffect(() => {
    let active = true;
    void settingsApi
      .backendApiKey(backendId, 'status')
      .then((text) => {
        if (active) setStatus(parseStatus(text));
      })
      .catch(() => {
        if (active) setMessage(t('keyStoreUnavailable'));
      });
    return () => {
      active = false;
    };
  }, [backendId]);

  async function change(action: 'set' | 'delete') {
    setBusy(true);
    setMessage('');
    const submitted = action === 'set' ? key : undefined;
    setKey('');
    try {
      const text = await settingsApi.backendApiKey(backendId, action, submitted);
      setStatus(parseStatus(text));
      setMessage(action === 'set' ? t('keySavedMessage') : t('keyDeletedMessage'));
    } catch {
      setMessage(t('keyChangeFailed'));
    } finally {
      setBusy(false);
    }
  }

  return { key, setKey, status, busy, message, change };
}

/** API キーの保存（保存できると申告しているバックエンドにだけ出す。envVar は、保存したキーがないときに使う環境変数） */
export function ApiKeySettings({ backend, envVar }: { backend: BackendInfo; envVar: string }) {
  const { key, setKey, status, busy, message, change } = useApiKeySettings(backend.id);
  const disabled = busy || !status?.supported;
  const hasSavedKey = status?.source === 'saved';
  return (
    <div>
      <p className={styles.help}>
        {t('keyStatusLine', { status: t(status ? SOURCE_KEYS[status.source] : 'keyChecking'), envVar })}
      </p>
      {status?.supported === false && <p className={styles.help}>{t('keyWindowsOnly')}</p>}
      <TextField
        label={t('keyLabel', { backend: backend.label })}
        type="password"
        autoComplete="new-password"
        spellCheck={false}
        value={key}
        onChange={setKey}
        disabled={disabled}
        maxLength={2560}
        hint={t('keyHint')}
      />
      <div className={styles.keyActions}>
        <Button size="sm" disabled={disabled || !key.trim()} onClick={() => void change('set')}>
          {hasSavedKey ? t('keyUpdate') : t('keySave')}
        </Button>
        <Button size="sm" disabled={busy || !hasSavedKey} onClick={() => void change('delete')}>
          {t('keyDelete')}
        </Button>
      </div>
      <p role="status" className={styles.help}>
        {message}
      </p>
    </div>
  );
}
