import type { ReactNode } from 'react';
import { Button, Icon, reportError } from '@/shared/ui';
import type { BackendInfo } from '@/shared/types/domain';
import { useCheckingBackends, useLoggingIn, useStartingBackend } from '../hooks/useRuntime';
import { t } from '../i18n';
import { BACKEND_STATUS_TONES, backendStatusWord } from '../model/status';
import { loginBackend, refreshBackends, startBackend } from '../store';
import styles from './BackendStatus.module.css';

export interface BackendStatusProps {
  backend: BackendInfo;
}

/**
 * バックエンドの状態の行: 準備 OK、または ⚠ 状態 ＋ 案内 ＋［起動］か［ログイン］（アプリからできるとき）＋［再確認］
 * （docs/ui-design.md §6.2）。何ができるかはバックエンドの申告（setup）で決まる。ログインは窓が閉じるまで待ち、その間は案内を差し替える
 */
export function BackendStatus({ backend }: BackendStatusProps) {
  if (backend.status === 'ready') {
    return (
      <p className={styles.ready}>
        <span className={styles.dot} aria-hidden="true" />
        <span className={styles.text}>
          {backendStatusWord('ready')}
          {backend.statusMessage && <span className={styles.message}>{backend.statusMessage}</span>}
        </span>
      </p>
    );
  }
  if (backend.setup.start !== null && backend.status === 'stopped') return <StoppedBackend backend={backend} />;
  return <BackendLoginStatus backend={backend} />;
}

function StoppedBackend({ backend }: BackendStatusProps) {
  const checking = useCheckingBackends();
  const starting = useStartingBackend() === backend.id;
  const message = starting ? t('startingModels', { backend: backend.label }) : backend.statusMessage;
  return (
    <BackendProblem backend={backend} message={message}>
      <Button
        size="sm"
        variant="primary"
        onClick={() => void startBackend(backend.id).catch(reportError)}
        disabled={checking}
      >
        {starting ? t('starting') : t('start', { backend: backend.label })}
      </Button>
    </BackendProblem>
  );
}

function BackendLoginStatus({ backend }: BackendStatusProps) {
  const loggingIn = useLoggingIn();
  const login = backend.status === 'needs_auth' ? backend.setup.login : null;
  const mine = loggingIn === backend.id;
  return (
    <BackendProblem backend={backend} message={mine && login ? login.waiting : backend.statusMessage}>
      {login && (
        <Button
          size="sm"
          variant="primary"
          onClick={() => void loginBackend(backend.id).catch(reportError)}
          disabled={loggingIn !== null}
        >
          {mine ? t('loggingIn') : login.label}
        </Button>
      )}
    </BackendProblem>
  );
}

function BackendProblem({ backend, message, children }: BackendStatusProps & { message: string; children: ReactNode }) {
  const checking = useCheckingBackends();
  return (
    <div className={styles.problem} data-tone={BACKEND_STATUS_TONES[backend.status]} role="status">
      <Icon name="alert" className={styles.icon} />
      <div className={styles.text}>
        <b className={styles.word}>{backendStatusWord(backend.status)}</b>
        {message && <span className={styles.message}>{message}</span>}
      </div>
      <div className={styles.actions}>
        {children}
        <Button size="sm" onClick={() => void refreshBackends().catch(reportError)} disabled={checking}>
          {checking ? t('checking') : t('recheck')}
        </Button>
      </div>
    </div>
  );
}
