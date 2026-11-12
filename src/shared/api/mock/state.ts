import type {
  Agent,
  AgentTemplate,
  BackendInfo,
  BootStatus,
  Channel,
  CustomFrame,
  Delegation,
  GuildProfile,
  Message,
  Profile,
  RuntimeStatus,
  Skill,
  StorageInfo,
  UpdateStatus,
} from '@/shared/types/domain';

/** 偽バックエンドが持つ全データ（Rust の DB とランナーの代わり）。配列は古い順に並べる */
export interface MockState {
  boot: BootStatus;
  /** ギルドの名前と紋（Rust では DB の meta 表） */
  guild: GuildProfile;
  me: Profile;
  /** 生成したアイコンの枠（Rust では DB の avatar_frames 表） */
  frames: CustomFrame[];
  /** 削除済み（deletedAt あり）も含む */
  agents: Agent[];
  channels: Channel[];
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
  /** 更新の確認結果（Rust では配布元の latest.json を見て決まる） */
  update: UpdateStatus;
  /** 次に保存する発言の seq */
  nextSeq: number;
}
