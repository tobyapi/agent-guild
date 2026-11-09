// ブラウザで UI を動かすための偽バックエンド（Tauri の外では自動でこれが使われる）。
// 全コマンドを実装し、発言・activity・状態の変化をイベントで再現する。失敗は CommandError で reject する。
import type { BootReason } from '@/shared/types/domain';
import { RECOVERY_COMMANDS } from '../contract';
import type { CommandName } from '../contract';
import type { Transport } from '../transport';
import { createMockEventBus } from './bus';
import { createConversation } from './conversation/conversation';
import { agentHandlers } from './handlers/agents';
import { channelHandlers } from './handlers/channels';
import { messageHandlers } from './handlers/messages';
import { skillLibraryHandlers } from './handlers/skillLibrary';
import { skillHandlers } from './handlers/skills';
import { storageHandlers } from './handlers/storage';
import { systemHandlers } from './handlers/system';
import type { MockHandlers, MockRuntime } from './handlers/types';
import { defaultEnv, emitStateChanged, fail } from './runtime';
import type { MockEnv } from './runtime';
import { createSeedState } from './seed';

const handlers: MockHandlers = {
  ...systemHandlers,
  ...storageHandlers,
  ...agentHandlers,
  ...skillHandlers,
  ...skillLibraryHandlers,
  ...channelHandlers,
  ...messageHandlers,
};

type BootFailure = Exclude<BootReason, 'none'>;
const BOOT_FAILURES: readonly BootFailure[] = [
  'missing',
  'locked',
  'newer_version',
  'foreign',
  'corrupt',
  'not_writable',
];

export interface MockTransportOptions {
  /** 応答までの擬似的な遅延（ms）。テストでは 0 */
  latencyMs?: number;
  /** ランナーが ready になるまでの時間（ms）。0 なら最初から ready */
  runtimeStartupMs?: number;
  /** ランナーが使えないまま止まる（理由）。帯の見た目の確認用 */
  runtimeFailure?: string | null;
  /** 復旧モードで起動する（データフォルダを開けなかった理由） */
  bootFailure?: BootFailure | null;
  /** スキルライブラリのフォルダを指定していない状態で始める */
  emptySkillLibrary?: boolean;
  /** 初回起動（初期設定のダイアログを出す）として始める */
  firstRun?: boolean;
  env?: Partial<MockEnv>;
}

/**
 * URL で画面の状態を確かめられるようにする:
 * ?mockBoot=missing など → 復旧画面、?mockRuntime=slow → 起動中の帯、?mockRuntime=unavailable → 使えないときの帯、
 * ?mockLibrary=empty → スキルライブラリが未設定、?mockSetup=1 → 初回起動（初期設定のダイアログ）
 */
export function mockOptionsFromLocation(): MockTransportOptions {
  if (typeof window === 'undefined') return {};
  const params = new URLSearchParams(window.location.search);
  const reason = params.get('mockBoot');
  const runtime = params.get('mockRuntime');
  return {
    bootFailure: BOOT_FAILURES.find((failure) => failure === reason) ?? null,
    emptySkillLibrary: params.get('mockLibrary') === 'empty',
    firstRun: params.get('mockSetup') === '1',
    ...(runtime === 'slow' ? { runtimeStartupMs: 8000 } : {}),
    ...(runtime === 'unavailable'
      ? { runtimeFailure: 'ランナーを起動できませんでした（モック）: node が見つかりません' }
      : {}),
  };
}

function isRecoveryCommand(command: CommandName): boolean {
  const allowed: readonly CommandName[] = RECOVERY_COMMANDS;
  return allowed.includes(command);
}

/** ランナーの起動（starting → ready、または unavailable のまま）を再現する */
function startRunner(runtime: MockRuntime, startupMs: number, failure: string | null): void {
  const ready = () => {
    runtime.state.runtime =
      failure === null ? { state: 'ready', message: '' } : { state: 'unavailable', message: failure };
  };
  if (startupMs <= 0) return ready();
  runtime.env.schedule(startupMs, () => {
    ready();
    emitStateChanged(runtime);
  });
}

export function createMockTransport(options: MockTransportOptions = {}): Transport {
  const env: MockEnv = { ...defaultEnv(), ...options.env };
  const state = createSeedState(env.now(), options.bootFailure ?? null);
  if (options.emptySkillLibrary) state.skillLibraryDirs = [];
  if (options.firstRun && state.boot.state === 'ok') state.boot = { ...state.boot, needsSetup: true };
  const core = { state, bus: createMockEventBus((task) => env.schedule(0, task)), env };
  const runtime: MockRuntime = { ...core, conversation: createConversation(core) };
  if (state.boot.state === 'ok') startRunner(runtime, options.runtimeStartupMs ?? 1500, options.runtimeFailure ?? null);
  const latencyMs = options.latencyMs ?? 60;
  return {
    async invoke(command, args) {
      if (latencyMs > 0) await new Promise<void>((resolve) => env.schedule(latencyMs, resolve));
      if (state.boot.state === 'recovery' && !isRecoveryCommand(command)) {
        fail('unavailable', 'データフォルダを開けないため、この操作はできません');
      }
      return structuredClone(handlers[command](structuredClone(args), runtime));
    },
    listen: (event, handler) => Promise.resolve(runtime.bus.on(event, handler)),
  };
}
