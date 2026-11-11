import type {
  Agent,
  AgentTemplate,
  BackendInfo,
  BootStatus,
  Channel,
  Delegation,
  Message,
  Profile,
  RuntimeStatus,
  Skill,
  StorageInfo,
} from '@/shared/types/domain';

/** 偽バックエンドが持つ全データ（Rust の DB とランナーの代わり）。配列は古い順に並べる */
export interface MockState {
  boot: BootStatus;
  me: Profile;
  /** 削除済み（deletedAt あり）も含む */
  agents: Agent[];
  channels: Channel[];
  /** 旧データへのロビーフラグ移行履歴。未定義は未適用 */
  lobbyMigrationApplied?: boolean;
  /** seq の昇順 */
  messages: Message[];
  /** 発言に貼った画像の中身（添付の ID → data URL。Rust ではデータフォルダの attachments/） */
  attachmentData: Record<string, string>;
  /** 割り振り（作成順） */
  delegations: Delegation[];
  skills: Skill[];
  /** スキルライブラリのフォルダ（Rust では settings.json の skillLibraryDirs） */
  skillLibraryDirs: string[];
  backends: BackendInfo[];
  templates: AgentTemplate[];
  runtime: RuntimeStatus;
  storage: StorageInfo;
  /** 次に保存する発言の seq */
  nextSeq: number;
}
