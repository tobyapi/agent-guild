import { useEffect, useState } from 'react';
import type { BackendInfo } from '@/shared/types/domain';
import { Button, TextField } from '@/shared/ui';
import { settingsApi } from '../api';
import styles from './SettingsDialog.module.css';

type KeyStatus = { source: 'saved' | 'environment' | 'unset'; supported: boolean };
const SOURCE_LABEL = {
  saved: '保存済みのキーを使っています',
  environment: '環境変数のキーを使っています',
  unset: 'キーは未設定です',
};

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
        if (active) setMessage('資格情報ストアを確認できませんでした。実行環境を確認して、設定を開き直してください。');
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
      setMessage(
        action === 'set'
          ? '保存しました。次の実行から使います。'
          : '保存済みのキーを削除しました。環境変数にキーがあれば、それを使います。',
      );
    } catch {
      setMessage('変更できませんでした。資格情報ストアと実行環境を確認して、必要ならもう一度入力してください。');
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
        {status ? SOURCE_LABEL[status.source] : 'キーの状態を確認しています'}
        。保存したキーを優先し、なければ環境変数 {envVar} を使います。
      </p>
      {status?.supported === false && <p className={styles.help}>キーの安全な保存は、現在 Windows だけで使えます。</p>}
      <TextField
        label={`${backend.label} の API キー`}
        type="password"
        autoComplete="new-password"
        spellCheck={false}
        value={key}
        onChange={setKey}
        disabled={disabled}
        maxLength={2560}
        hint="Windows の資格情報マネージャーに保存します。保存済みのキーは表示しません。"
      />
      <div className={styles.sectionAction}>
        <Button size="sm" disabled={disabled || !key.trim()} onClick={() => void change('set')}>
          {hasSavedKey ? '更新' : '保存'}
        </Button>
        <Button size="sm" disabled={busy || !hasSavedKey} onClick={() => void change('delete')}>
          削除
        </Button>
      </div>
      <p role="status" className={styles.help}>
        {message}
      </p>
    </div>
  );
}
