// 実行環境とバックエンドの状態の表し方（docs/ui-design.md §6.1・§6.2）。
import type { BackendInfo, BackendStatus, RuntimeStatus } from '@/shared/types/domain';
import { t } from '../i18n';

const STATUS_WORD_KEYS = {
  ready: 'statusReady',
  needs_auth: 'statusNeedsAuth',
  stopped: 'statusStopped',
  unavailable: 'statusUnavailable',
} as const satisfies Record<BackendStatus, string>;

/** 札や状態の行に出す言葉（いまの言語） */
export function backendStatusWord(status: BackendStatus): string {
  return t(STATUS_WORD_KEYS[status]);
}

export type StatusTone = 'neutral' | 'warning' | 'danger';

export const BACKEND_STATUS_TONES: Readonly<Record<BackendStatus, StatusTone>> = {
  ready: 'neutral',
  needs_auth: 'warning',
  stopped: 'warning',
  unavailable: 'danger',
};

/** ツールチップ: 表示名と、準備ができていなければその案内 */
export function backendTitle(backend: BackendInfo): string {
  return backend.statusMessage ? `${backend.label} — ${backend.statusMessage}` : backend.label;
}

export interface RuntimeBannerModel {
  state: 'starting' | 'unavailable';
  title: string;
  detail: string;
}

/** ランナーの状態の帯。ready なら出さない */
export function runtimeBanner(runtime: RuntimeStatus): RuntimeBannerModel | null {
  if (runtime.state === 'starting') {
    return { state: 'starting', title: t('runtimeStarting'), detail: '' };
  }
  if (runtime.state === 'unavailable') {
    return { state: 'unavailable', title: t('runtimeUnavailable'), detail: runtime.message };
  }
  return null;
}
