import { invoke } from '@/shared/api';

export const runtimeApi = {
  /** ランナーの確認結果を待つ。完了後に snapshot で最新状態を取得する */
  refreshBackends: () => invoke('refresh_backends'),
  snapshot: () => invoke('get_snapshot'),
  /** 止まっているバックエンドのアプリを開き、使えるようになるまで待つ */
  startBackend: (backendId: string) => invoke('start_backend', { backendId }),
  /** ログインを始め、利用者が終える（窓が閉じる）まで待つ。終わった後の状態は state-changed で届く */
  loginBackend: (backendId: string) => invoke('login_backend', { backendId }),
  restartApp: () => invoke('restart_app'),
};
