// 実行環境の状態: ランナー（Snapshot.runtime）・バックエンド（Snapshot.backends）・実行状況（ActivityState）。
import { create } from 'zustand';
import { notifyInfo } from '@/shared/ui';
import type { ActivityState, BackendInfo, RuntimeStatus, Snapshot } from '@/shared/types/domain';
import { runtimeApi } from './api';

interface RuntimeStoreState {
  runtime: RuntimeStatus;
  backends: BackendInfo[];
  activity: ActivityState;
  /** activity-changed を受け取るたびに増える（取得中に届いた新しい状態を古いスナップショットで上書きしないため） */
  activityRevision: number;
  /** 「再確認」の結果を取得するまで */
  checkingBackends: boolean;
  startingOllama: boolean;
  /** ログイン中のバックエンド（［ログイン］を押してから、窓が閉じるまで） */
  loggingIn: string | null;
}

export const useRuntimeStore = create<RuntimeStoreState>()(() => ({
  runtime: { state: 'starting', message: '' },
  backends: [],
  activity: { activities: [], queues: [] },
  activityRevision: 0,
  checkingBackends: false,
  startingOllama: false,
  loggingIn: null,
}));

export function currentActivityRevision(): number {
  return useRuntimeStore.getState().activityRevision;
}

/**
 * スナップショットを反映する。取得を始めた時点（activityRevision）より後に activity-changed が届いていれば、
 * activity はそちらを残す。止まっていた実行環境が戻ったらトーストで知らせる。
 */
export function applyRuntimeSnapshot(
  snapshot: Pick<Snapshot, 'runtime' | 'backends' | 'activity'>,
  activityRevision: number,
): void {
  const previous = useRuntimeStore.getState();
  useRuntimeStore.setState({
    runtime: snapshot.runtime,
    backends: snapshot.backends,
    activity: previous.activityRevision === activityRevision ? snapshot.activity : previous.activity,
  });
  if (previous.runtime.state === 'unavailable' && snapshot.runtime.state === 'ready') {
    notifyInfo('実行環境の準備ができました');
  }
}

export function setActivity(activity: ActivityState): void {
  useRuntimeStore.setState((state) => ({ activity, activityRevision: state.activityRevision + 1 }));
}

export async function refreshBackends(): Promise<void> {
  const { checkingBackends, startingOllama } = useRuntimeStore.getState();
  if (checkingBackends || startingOllama) return;
  useRuntimeStore.setState({ checkingBackends: true });
  try {
    await runtimeApi.refreshBackends();
    await applyLatestBackendSnapshot();
    notifyInfo('バックエンドの再確認が完了しました。各バックエンドの状態を確認してください。');
  } finally {
    useRuntimeStore.setState({ checkingBackends: false });
  }
}

export async function startOllama(): Promise<void> {
  const { checkingBackends, startingOllama } = useRuntimeStore.getState();
  if (checkingBackends || startingOllama) return;
  useRuntimeStore.setState({ startingOllama: true });
  try {
    await runtimeApi.startOllama();
    await applyLatestBackendSnapshot();
  } finally {
    useRuntimeStore.setState({ startingOllama: false });
  }
}

async function applyLatestBackendSnapshot(): Promise<void> {
  const revision = currentActivityRevision();
  const snapshot = await runtimeApi.snapshot();
  applyRuntimeSnapshot(snapshot, revision);
}

/** アプリからログインを始め、利用者が終える（窓が閉じる）まで待つ。ログインできなければ reject */
export async function loginBackend(backendId: string): Promise<void> {
  useRuntimeStore.setState({ loggingIn: backendId });
  try {
    await runtimeApi.loginBackend(backendId);
  } finally {
    useRuntimeStore.setState({ loggingIn: null });
  }
}

export async function restartApp(): Promise<void> {
  await runtimeApi.restartApp();
}
