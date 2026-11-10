import type { ReactNode } from 'react';
import { Button, Icon, reportError } from '@/shared/ui';
import type { BackendInfo } from '@/shared/types/domain';
import { useCheckingBackends, useLoggingIn, useStartingOllama } from '../hooks/useRuntime';
import { BACKEND_STATUS_TONES, BACKEND_STATUS_WORDS, LOGGING_IN_MESSAGE } from '../model/status';
import { loginBackend, refreshBackends, startOllama } from '../store';
import styles from './BackendStatus.module.css';

export interface BackendStatusProps {
  backend: BackendInfo;
}

/**
 * バックエンドの状態の行: 準備 OK、または ⚠ 状態 ＋ 案内 ＋［ログイン］（アプリからログインできるとき）＋［再確認］
 * （docs/ui-design.md §6.2）。ログインは窓が閉じるまで待ち、その間は案内を差し替える
 */
export function BackendStatus({ backend }: BackendStatusProps) {
  if (backend.status === 'ready') {
    return (
      <p className={styles.ready}>
        <span className={styles.dot} aria-hidden="true" />
        <span className={styles.text}>
          {BACKEND_STATUS_WORDS.ready}
          {backend.statusMessage && <span className={styles.message}>{backend.statusMessage}</span>}
        </span>
      </p>
    );
  }
  if (backend.id === 'ollama' && backend.status === 'stopped') return <StoppedOllama backend={backend} />;
  return <BackendLoginStatus backend={backend} />;
}

function StoppedOllama({ backend }: BackendStatusProps) {
  const checking = useCheckingBackends();
  const starting = useStartingOllama();
  const message = starting ? 'Ollama の起動とモデル一覧の読み込みを待っています。' : backend.statusMessage;
  return (
    <BackendProblem backend={backend} message={message}>
      <Button size="sm" variant="primary" onClick={() => void startOllama().catch(reportError)} disabled={checking}>
        {starting ? '起動中…' : 'Ollama を起動'}
      </Button>
    </BackendProblem>
  );
}

function BackendLoginStatus({ backend }: BackendStatusProps) {
  const loggingIn = useLoggingIn();
  const canLogin = backend.canLogin && backend.status === 'needs_auth';
  const mine = loggingIn === backend.id;
  const loginMessage = backend.id === 'codex' ? 'ブラウザーで ChatGPT にログインしてください。' : LOGGING_IN_MESSAGE;
  const loginLabel =
    backend.id === 'codex' ? 'ChatGPT でログイン' : backend.id === 'claude' ? 'Claude Code でログイン' : 'ログイン';
  return (
    <BackendProblem backend={backend} message={mine ? loginMessage : backend.statusMessage}>
      {canLogin && (
        <Button
          size="sm"
          variant="primary"
          onClick={() => void loginBackend(backend.id).catch(reportError)}
          disabled={loggingIn !== null}
        >
          {mine ? 'ログイン中…' : loginLabel}
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
        <b className={styles.word}>{BACKEND_STATUS_WORDS[backend.status]}</b>
        {message && <span className={styles.message}>{message}</span>}
      </div>
      <div className={styles.actions}>
        {children}
        <Button size="sm" onClick={() => void refreshBackends().catch(reportError)} disabled={checking}>
          {checking ? '確認中…' : '再確認'}
        </Button>
      </div>
    </div>
  );
}
