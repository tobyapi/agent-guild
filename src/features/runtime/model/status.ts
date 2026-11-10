// 実行環境とバックエンドの状態の表し方（docs/ui-design.md §6.1・§6.2）。
import type { BackendInfo, BackendStatus, RuntimeStatus } from '@/shared/types/domain';

/** 札や状態の行に出す言葉 */
export const BACKEND_STATUS_WORDS: Readonly<Record<BackendStatus, string>> = {
  ready: '準備 OK',
  needs_auth: 'ログインが必要',
  stopped: '停止中',
  unavailable: '使えません',
};

/** ［ログイン］を押してから窓が閉じるまで、状態の行に出す案内 */
export const LOGGING_IN_MESSAGE = '開いた窓とブラウザでログインを進めてください。終わると自動で状態が変わります。';

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
    return { state: 'starting', title: 'エージェントの実行環境を起動しています…', detail: '' };
  }
  if (runtime.state === 'unavailable') {
    return { state: 'unavailable', title: 'エージェントを動かせません', detail: runtime.message };
  }
  return null;
}
