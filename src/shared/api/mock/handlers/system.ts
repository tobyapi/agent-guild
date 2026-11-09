// 起動状態・スナップショット・プロフィール・バックエンドの再確認・再起動・リンクを開く。
import { isExternalUrl } from '@/shared/lib/links';
import { checkMemberName } from '@/shared/lib/names';
import { activeAgents, emitStateChanged, fail } from '../runtime';
import { RESTART_DELAY_MS } from './types';
import type { HandlerGroup } from './types';

type SystemCommands =
  | 'get_boot_status'
  | 'complete_setup'
  | 'get_snapshot'
  | 'update_profile'
  | 'refresh_backends'
  | 'login_backend'
  | 'backend_api_key'
  | 'restart_app'
  | 'open_url';

/** 「再確認」で probe してから結果が届くまでの間 */
const PROBE_MS = 800;
/** ［ログイン］を押してから、ブラウザでのログインが済んだことにするまでの間 */
const LOGIN_MS = 1500;

export const systemHandlers: HandlerGroup<SystemCommands> = {
  backend_api_key() {
    fail('unavailable', 'APIキー設定はデスクトップアプリで利用してください');
  },
  get_boot_status: (_args, runtime) => runtime.state.boot,

  complete_setup(_args, runtime) {
    runtime.state.boot = { ...runtime.state.boot, needsSetup: false };
    return null;
  },

  get_snapshot: (_args, { state, conversation }) => ({
    me: state.me,
    agents: state.agents,
    channels: state.channels,
    backends: state.backends,
    templates: state.templates,
    runtime: state.runtime,
    activity: conversation.activityState(),
  }),

  update_profile({ profile }, runtime) {
    const problem = checkMemberName(
      profile.name,
      activeAgents(runtime).map((agent) => agent.name),
    );
    if (problem !== null) fail('validation', problem, 'name');
    runtime.state.me = { ...profile, name: profile.name.trim() };
    emitStateChanged(runtime);
    return runtime.state.me;
  },

  /** モックでは、ログインを済ませた想定で全バックエンドを ready にする */
  refresh_backends(_args, runtime) {
    if (runtime.state.runtime.state !== 'ready') fail('unavailable', 'エージェントの実行環境が起動していません');
    runtime.env.schedule(PROBE_MS, () => {
      runtime.state.backends = runtime.state.backends.map((backend) => ({ ...backend, status: 'ready', statusMessage: '' }));
      emitStateChanged(runtime);
    });
    return null;
  },

  /** Rust はログインの窓が閉じるまで待つが、モックはすぐ返して少し後に ready にする */
  login_backend({ backendId }, runtime) {
    const backend = runtime.state.backends.find((item) => item.id === backendId);
    if (!backend) fail('not_found', 'バックエンドが見つかりません');
    if (!backend.canLogin) fail('validation', `${backend.label} はアプリからログインできません`);
    runtime.env.schedule(LOGIN_MS, () => {
      runtime.state.backends = runtime.state.backends.map((item) =>
        item.id === backendId ? { ...item, status: 'ready', statusMessage: '' } : item,
      );
      emitStateChanged(runtime);
    });
    return null;
  },

  restart_app(_args, runtime) {
    runtime.env.schedule(RESTART_DELAY_MS, runtime.env.restart);
    return null;
  },

  open_url({ url }, runtime) {
    if (!isExternalUrl(url.trim())) fail('validation', '開けるのは http と https のリンクだけです', 'url');
    runtime.env.openUrl(url.trim());
    return null;
  },
};
