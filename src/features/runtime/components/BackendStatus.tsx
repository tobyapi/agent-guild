import { Button, Icon, reportError } from '@/shared/ui';
import type { BackendInfo } from '@/shared/types/domain';
import { useCheckingBackends, useLoggingIn } from '../hooks/useRuntime';
import { BACKEND_STATUS_TONES, BACKEND_STATUS_WORDS, LOGGING_IN_MESSAGE } from '../model/status';
import { loginBackend, refreshBackends } from '../store';
import styles from './BackendStatus.module.css';

export interface BackendStatusProps {
  backend: BackendInfo;
}

/**
 * バックエンドの状態の行: 準備 OK、または ⚠ 状態 ＋ 案内 ＋［ログイン］（アプリからログインできるとき）＋［再確認］
 * （docs/ui-design.md §6.2）。ログインは窓が閉じるまで待ち、その間は案内を差し替える
 */
export function BackendStatus({ backend }: BackendStatusProps) {
  const checking = useCheckingBackends();
  const loggingIn = useLoggingIn();
  if (backend.status === 'ready') {
    return (
      <p className={styles.ready}>
        <span className={styles.dot} aria-hidden="true" />
        {BACKEND_STATUS_WORDS.ready}
      </p>
    );
  }
  const canLogin = backend.canLogin && backend.status === 'needs_auth';
  const mine = loggingIn === backend.id;
  const message = mine ? LOGGING_IN_MESSAGE : backend.statusMessage;
  return (
    <div className={styles.problem} data-tone={BACKEND_STATUS_TONES[backend.status]} role="status">
      <Icon name="alert" className={styles.icon} />
      <div className={styles.text}>
        <b className={styles.word}>{BACKEND_STATUS_WORDS[backend.status]}</b>
        {message && <span className={styles.message}>{message}</span>}
      </div>
      <div className={styles.actions}>
        {canLogin && (
          <Button
            size="sm"
            variant="primary"
            onClick={() => void loginBackend(backend.id).catch(reportError)}
            disabled={loggingIn !== null}
          >
            {mine ? 'ログイン中…' : 'ログイン'}
          </Button>
        )}
        <Button size="sm" onClick={() => void refreshBackends().catch(reportError)} disabled={checking}>
          {checking ? '確認中…' : '再確認'}
        </Button>
      </div>
    </div>
  );
}
