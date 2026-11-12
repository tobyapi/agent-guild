// アプリの更新の状態と、その言い表し方（docs/ui-design.md §6.7）。
import type { AvailableUpdate, UpdateStatus } from '@/shared/types/domain';

export type UpdatePhase = 'idle' | 'checking' | 'installing';

export interface UpdateState {
  phase: UpdatePhase;
  /** 最後に確かめた結果（まだ確かめていなければ null） */
  status: UpdateStatus | null;
  /** 最後の確認・更新の失敗（成功したら消える） */
  error: string | null;
}

export const INITIAL_UPDATE_STATE: UpdateState = { phase: 'idle', status: null, error: null };

/** 設定の「アプリの更新」に出す1行（いまの版と、最新かどうか） */
export function updateSummary({ phase, status }: UpdateState): string {
  if (status === null) return phase === 'checking' ? '新しい版を確認しています…' : 'まだ確認していません';
  if (status.latest === null) return `いまの版 ${status.currentVersion} は最新です`;
  return `新しい版 ${status.latest.version} があります（いまは ${status.currentVersion}）`;
}

/** 起動時などに出す知らせの文面 */
export const updateNotice = (latest: AvailableUpdate): string => `新しい版 ${latest.version} があります`;

/** 知らせるべき新しい版（もう知らせた版なら null。同じ版を何度も知らせない） */
export function versionToNotify(status: UpdateStatus | null, notified: string | null): AvailableUpdate | null {
  const latest = status?.latest ?? null;
  return latest !== null && latest.version !== notified ? latest : null;
}
