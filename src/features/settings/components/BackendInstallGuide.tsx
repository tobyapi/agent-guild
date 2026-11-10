import { Button, notifyError, notifyInfo, reportError, TextAreaField } from '@/shared/ui';
import { settingsApi, type SetupBackend } from '../api';
import { setUpBackend, useSettingsStore } from '../store';
import styles from './SettingsDialog.module.css';

const GUIDES = {
  claude: {
    label: 'Claude',
    cli: 'Claude Code',
    publisher: 'Anthropic',
    command: 'curl -fsSL https://claude.ai/install.sh | bash',
    docs: 'https://code.claude.com/docs/ja/quickstart',
    login: 'claude auth login',
  },
  codex: {
    label: 'Codex',
    cli: 'Codex CLI',
    publisher: 'OpenAI',
    command: 'curl -fsSL https://chatgpt.com/codex/install.sh | sh',
    docs: 'https://learn.chatgpt.com/docs/codex/cli#install-codex',
    login: 'codex login',
  },
};

async function copyInstallCommand(command: string) {
  try {
    await navigator.clipboard.writeText(command);
    notifyInfo('インストールコマンドをコピーしました。');
  } catch {
    notifyError('自動でコピーできませんでした。コマンド欄を選択してコピーしてください。');
  }
}

export function BackendInstallGuide({ backendId }: { backendId: SetupBackend }) {
  const settingUp = useSettingsStore((state) => state.settingUpBackend);
  const error = useSettingsStore((state) => state.setupErrors[backendId]);
  const guide = GUIDES[backendId];
  const inProgress = settingUp === backendId;
  const mac = typeof navigator !== 'undefined' && /Macintosh/.test(navigator.userAgent);
  return (
    <>
      {mac && (
        <div className={styles.guideActions}>
          <Button
            size="sm"
            variant="primary"
            onClick={() => void setUpBackend(backendId, guide.label)}
            disabled={settingUp !== null}
          >
            {inProgress ? 'セットアップ中…' : error ? 'もう一度試す' : `${guide.label} をセットアップ`}
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

function ManualInstallGuide({ guide }: { guide: (typeof GUIDES)[SetupBackend] }) {
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
          value={guide.command}
          onChange={() => {}}
          onFocus={(event) => event.currentTarget.select()}
          rows={2}
          mono
          readOnly
        />
        <div className={styles.guideActions}>
          <Button size="sm" onClick={() => void copyInstallCommand(guide.command)}>
            コマンドをコピー
          </Button>
          <Button size="sm" variant="link" onClick={() => void settingsApi.openUrl(guide.docs).catch(reportError)}>
            {guide.publisher} の公式手順（Windows も含む）
          </Button>
        </div>
        <p className={styles.help}>
          インストールが完了したら、この画面の「再確認」を押してください。ターミナルからログインする場合は、新しいターミナルで{' '}
          <code>{guide.login}</code> を実行してください。
        </p>
      </div>
    </details>
  );
}
