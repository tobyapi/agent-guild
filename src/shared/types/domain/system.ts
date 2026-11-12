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

/** 入れられる新しい版 */
export interface AvailableUpdate {
  version: string;
  /** リリースの説明（なければ空） */
  notes: string;
}

/** 更新の確認結果（check_update）。latest が null なら、いまの版が最新 */
export interface UpdateStatus {
  currentVersion: string;
  latest: AvailableUpdate | null;
}

/** 保存先変更のしかた: copy = 今のデータを空のフォルダにコピーして使う / open = その場所のデータを開く（空なら新規） */
export type DataDirMode = 'copy' | 'open';

/**
 * 表示とエージェントの会話の言語（settings.json の language）。日本語・英語・簡体字・繁体字・韓国語。
 * 画面の固定の文字列と、エージェントが会話に使う言語の両方を決める
 */
export type Language = 'ja' | 'en' | 'zh-Hans' | 'zh-Hant' | 'ko';

export type BootState = 'ok' | 'recovery';
export type BootReason = 'none' | 'missing' | 'locked' | 'newer_version' | 'foreign' | 'corrupt' | 'not_writable';

export interface BootStatus {
  state: BootState;
  reason: BootReason;
  dataDir: string;
  message: string;
  /** 初回起動の初期設定（名前・スキルのフォルダ・データの保存先）がまだ（初期設定のダイアログを出す。復旧モードでは false） */
  needsSetup: boolean;
  /** 保存した言語。まだ選んでいなければ null（初回起動なら React が OS の言語から選び、そうでなければ日本語として扱う） */
  language: Language | null;
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
