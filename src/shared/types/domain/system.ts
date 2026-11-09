import type { ActivityState } from './activity';
import type { Agent, AgentTemplate } from './agent';
import type { BackendInfo, RuntimeStatus } from './backend';
import type { Channel, Profile } from './conversation';

export interface Snapshot {
  me: Profile;
  /** 削除済み（deletedAt あり）も含む */
  agents: Agent[];
  channels: Channel[];
  backends: BackendInfo[];
  /** エージェント作成のテンプレート（作業者・専門家など） */
  templates: AgentTemplate[];
  runtime: RuntimeStatus;
  activity: ActivityState;
}

export type StorageSource = 'default' | 'settings' | 'env';

export interface StorageInfo {
  /** いま使っているデータフォルダ（guild.db と agents/ がある場所） */
  dataDir: string;
  defaultDataDir: string;
  source: StorageSource;
}

/** 保存先変更のしかた: copy = 今のデータを空のフォルダにコピーして使う / open = その場所のデータを開く（空なら新規） */
export type DataDirMode = 'copy' | 'open';

export type BootState = 'ok' | 'recovery';
export type BootReason = 'none' | 'missing' | 'locked' | 'newer_version' | 'foreign' | 'corrupt' | 'not_writable';

export interface BootStatus {
  state: BootState;
  reason: BootReason;
  dataDir: string;
  message: string;
  /** 初回起動の初期設定（名前・スキルのフォルダ・データの保存先）がまだ（初期設定のダイアログを出す。復旧モードでは false） */
  needsSetup: boolean;
}

export type ErrorCode = 'not_found' | 'validation' | 'conflict' | 'storage' | 'runtime' | 'unavailable' | 'internal';

/** すべてのコマンドが失敗時に reject する値 */
export interface CommandError {
  code: ErrorCode;
  message: string;
  /**
   * validation のとき、どの入力のことか（コマンドの入力の camelCase のキー。例: "name"・"autonomyIntervalMin"・
   * "grantedPermissions"・"path"）。特定の入力に結びつかないときは null
   */
  field: string | null;
}
