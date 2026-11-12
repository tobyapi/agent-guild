import { Button, notifyError, notifyInfo, reportError, TextAreaField } from '@/shared/ui';
import type { BackendInfo, InstallGuide } from '@/shared/types/domain';
import { settingsApi } from '../api';
import { tBackends as t } from '../i18n/backends';
import { setUpBackend, useSettingsStore } from '../store';
import styles from './SettingsDialog.module.css';

/** 利用者がターミナルで実行するコマンド（公式のインストーラーを取得して、そのシェルで動かす） */
function installCommand(guide: InstallGuide): string {
  return `curl -fsSL ${guide.scriptUrl} | ${guide.shell.split('/').pop() ?? 'sh'}`;
}

async function copyInstallCommand(command: string) {
  try {
    await navigator.clipboard.writeText(command);
    notifyInfo(t('copied'));
  } catch {
    notifyError(t('copyFailed'));
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
            {inProgress ? t('settingUp') : error ? t('retry') : t('setUp', { backend: backend.label })}
          </Button>
          {inProgress && (
            <p className={styles.help} role="status">
              {t('installing', { cli: guide.cli })}
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
  // 文言の中のログインのコマンドの位置に <code> を置く
  const [beforeLogin, afterLogin] = t('afterInstall').split('{command}');
  return (
    <details>
      <summary className={styles.guideSummary}>{t('manualSummary', { cli: guide.cli })}</summary>
      <div className={styles.guideBody}>
        <p className={styles.help}>{t('manualIntro', { publisher: guide.publisher, cli: guide.cli })}</p>
        <TextAreaField
          label={t('commandLabel')}
          value={command}
          onChange={() => {}}
          onFocus={(event) => event.currentTarget.select()}
          rows={2}
          mono
          readOnly
        />
        <div className={styles.guideActions}>
          <Button size="sm" onClick={() => void copyInstallCommand(command)}>
            {t('copyCommand')}
          </Button>
          <Button size="sm" variant="link" onClick={() => void settingsApi.openUrl(guide.docsUrl).catch(reportError)}>
            {t('officialSteps', { publisher: guide.publisher })}
          </Button>
        </div>
        <p className={styles.help}>
          {beforeLogin}
          <code>{guide.loginCommand}</code>
          {afterLogin}
        </p>
      </div>
    </details>
  );
}
