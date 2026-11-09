import { useEffect, useState } from 'react';
import { Button, TextField } from '@/shared/ui';
import { settingsApi } from '../api';
import styles from './SettingsDialog.module.css';

type KeyStatus = { source: 'saved' | 'environment' | 'unset'; supported: boolean };
const SOURCE_LABEL = { saved: '保存済みキーを使用', environment: '環境変数のキーを使用', unset: '未設定' };

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

function useApiKeySettings(backendId: 'grok' | 'muse') {
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
        if (active) setMessage('資格情報ストアを確認できない。実行環境を確認して、設定を開き直してください。');
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
        action === 'set' ? '保存した。次の実行から使用する。' : '保存済みキーを削除した。環境変数があれば使用する。',
      );
    } catch {
      setMessage('変更できなかった。資格情報ストアと実行環境を確認して、必要なら再入力してください。');
    } finally {
      setBusy(false);
    }
  }

  return { key, setKey, status, busy, message, change };
}

export function ApiKeySettings({ backendId }: { backendId: 'grok' | 'muse' }) {
  const { key, setKey, status, busy, message, change } = useApiKeySettings(backendId);
  const disabled = busy || !status?.supported;
  const hasSavedKey = status?.source === 'saved';
  return (
    <div>
      <p className={styles.help}>
        {status ? SOURCE_LABEL[status.source] : 'キーの状態を確認中'}。 保存したキーを優先し、未設定なら
        {backendId === 'grok' ? 'XAI_API_KEY' : 'MODEL_API_KEY'}を使う。
      </p>
      {status?.supported === false && <p className={styles.help}>安全なキー保存は現在Windowsのみ対応。</p>}
      <TextField
        label={`${backendId === 'grok' ? 'Grok' : 'Muse Spark'} APIキー`}
        type="password"
        autoComplete="new-password"
        spellCheck={false}
        value={key}
        onChange={setKey}
        disabled={disabled}
        maxLength={2560}
        hint="Windows資格情報マネージャーに保存する。保存済みキーは表示しない。"
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
