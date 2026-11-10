import { Button, notifyError, notifyInfo, reportError, TextAreaField } from '@/shared/ui';
import { settingsApi } from '../api';
import styles from './SettingsDialog.module.css';

const INSTALL_COMMAND = 'curl -fsSL https://chatgpt.com/codex/install.sh | sh';
const INSTALL_DOCS = 'https://learn.chatgpt.com/docs/codex/cli#install-codex';

async function copyInstallCommand() {
  try {
    await navigator.clipboard.writeText(INSTALL_COMMAND);
    notifyInfo('インストールコマンドをコピーしました。');
  } catch {
    notifyError('自動でコピーできませんでした。コマンド欄を選択してコピーしてください。');
  }
}

export function CodexInstallGuide() {
  return (
    <details>
      <summary className={styles.guideSummary}>Codex CLI のインストール手順</summary>
      <div className={styles.guideBody}>
        <p className={styles.help}>
          AIギルドは、ターミナルから使える Codex CLI に接続します。macOS と Linux では、Node.js や Homebrew がなくても
          OpenAI のスタンドアロン版を入れられます。
        </p>
        <TextAreaField
          label="ターミナルで実行するコマンド（macOS・Linux）"
          value={INSTALL_COMMAND}
          onChange={() => {}}
          onFocus={(event) => event.currentTarget.select()}
          rows={2}
          mono
          readOnly
        />
        <div className={styles.guideActions}>
          <Button size="sm" onClick={() => void copyInstallCommand()}>
            コマンドをコピー
          </Button>
          <Button size="sm" variant="link" onClick={() => void settingsApi.openUrl(INSTALL_DOCS).catch(reportError)}>
            OpenAI の公式手順（Windows も含む）
          </Button>
        </div>
        <p className={styles.help}>
          インストールが完了したら、この画面の「再確認」を押してください。ログインが必要な場合は、新しいターミナルで{' '}
          <code>codex login</code> を実行してから、もう一度「再確認」を押してください。
        </p>
      </div>
    </details>
  );
}
