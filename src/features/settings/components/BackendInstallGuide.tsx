import { Button, notifyError, notifyInfo, reportError, TextAreaField } from '@/shared/ui';
import type { BackendInfo, InstallGuide } from '@/shared/types/domain';
import { settingsApi } from '../api';
import { setUpBackend, useSettingsStore } from '../store';
import styles from './SettingsDialog.module.css';

/** 利用者がターミナルで実行するコマンド（公式のインストーラーを取得して、そのシェルで動かす） */
function installCommand(guide: InstallGuide): string {
  return `curl -fsSL ${guide.scriptUrl} | ${guide.shell.split('/').pop() ?? 'sh'}`;
}

async function copyInstallCommand(command: string) {
  try {
    await navigator.clipboard.writeText(command);
    notifyInfo('インストールコマンドをコピーしました。');
  } catch {
    notifyError('自動でコピーできませんでした。コマンド欄を選択してコピーしてください。');
  }
}

/** CLI のインストールの案内（インストールできると申告している、使えない状態のバックエンドに出す） */
export function BackendInstallGuide({ backend, guide }: { backend: BackendInfo; guide: InstallGuide }) {
  const settingUp = useSettingsStore((state) => state.settingUpBackend);
  const error = useSettingsStore((state) => state.setupErrors[backend.id]);
  const inProgress = settingUp === backend.id;
  const mac = typeof navigator !== 'undefined' && /Macintosh/.test(navigator.userAgent);
  return (
    <>
      {mac && (
        <div className={styles.guideActions}>
          <Button
            size="sm"
            variant="primary"
            onClick={() => void setUpBackend(backend.id, backend.label)}
            disabled={settingUp !== null}
          >
            {inProgress ? 'セットアップ中…' : error ? 'もう一度試す' : `${backend.label} をセットアップ`}
          </Button>
          {inProgress && (
            <p className={styles.help} role="status">
              {guide.cli} をダウンロードしてインストールしています。数分かかることがあります。
            </p>
          )}
          {error && <p role="alert">{error}</p>}
        </div>
      )}
      <ManualInstallGuide guide={guide} />
    </>
  );
}

function ManualInstallGuide({ guide }: { guide: InstallGuide }) {
  const command = installCommand(guide);
  return (
    <details>
      <summary className={styles.guideSummary}>{guide.cli} のインストール手順</summary>
      <div className={styles.guideBody}>
        <p className={styles.help}>
          macOS と Linux では、Node.js や Homebrew がなくても {guide.publisher} の公式インストーラーで {guide.cli}{' '}
          を入れられます。
        </p>
        <TextAreaField
          label="ターミナルで実行するコマンド（macOS・Linux）"
          value={command}
          onChange={() => {}}
          onFocus={(event) => event.currentTarget.select()}
          rows={2}
          mono
          readOnly
        />
        <div className={styles.guideActions}>
          <Button size="sm" onClick={() => void copyInstallCommand(command)}>
            コマンドをコピー
          </Button>
          <Button size="sm" variant="link" onClick={() => void settingsApi.openUrl(guide.docsUrl).catch(reportError)}>
            {guide.publisher} の公式手順（Windows も含む）
          </Button>
        </div>
        <p className={styles.help}>
          インストールが完了したら、この画面の「再確認」を押してください。ターミナルからログインする場合は、新しいターミナルで{' '}
          <code>{guide.loginCommand}</code> を実行してください。
        </p>
      </div>
    </details>
  );
}
