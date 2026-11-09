import { invoke } from '@/shared/api';

export const runtimeApi = {
  /** ランナーにバックエンドの状態を確かめ直させる（結果は state-changed で届く） */
  refreshBackends: () => invoke('refresh_backends'),
  /** ログインを始め、利用者が終える（窓が閉じる）まで待つ。終わった後の状態は state-changed で届く */
  loginBackend: (backendId: string) => invoke('login_backend', { backendId }),
  restartApp: () => invoke('restart_app'),
};
