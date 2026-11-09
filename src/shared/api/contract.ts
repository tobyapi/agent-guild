// React ⇄ Rust の IPC 契約の型表。docs/design.md §3（コマンド）・§4（イベント）の表と常に一致させる。
// コマンドを足すときはここに1行足し、contractSchemas.ts に戻り値の検証を足し、使う feature の api.ts から呼ぶ。
import type {
  ActivityState,
  Agent,
  AgentInput,
  AttachmentInput,
  BootStatus,
  Channel,
  DataDirMode,
  Delegation,
  LibraryAddMode,
  Message,
  Profile,
  Skill,
  SkillInput,
  SkillLibrary,
  Snapshot,
  StorageInfo,
} from '@/shared/types/domain';

/** 引数を取らないコマンド */
type NoArgs = Record<never, never>;

/** コマンド名 → 引数（JS 側は camelCase）と戻り値。失敗はすべて CommandError で reject される */
export interface CommandMap {
  get_boot_status: { args: NoArgs; result: BootStatus };
  /** 初回起動の初期設定を終えた（名前・スキルのフォルダ・保存先はそれぞれのコマンドで保存する） */
  complete_setup: { args: NoArgs; result: null };
  get_snapshot: { args: NoArgs; result: Snapshot };
  create_agent: { args: { input: AgentInput }; result: Agent };
  update_agent: { args: { id: string; input: AgentInput }; result: Agent };
  delete_agent: { args: { id: string }; result: null };
  run_autonomous: { args: { agentId: string }; result: null };
  open_agent_workspace: { args: { agentId: string }; result: null };
  list_skills: { args: { agentId: string }; result: Skill[] };
  save_skill: { args: { input: SkillInput }; result: Skill };
  delete_skill: { args: { id: string }; result: null };
  /** 呼ぶたびにライブラリのフォルダを走査し直す */
  get_skill_library: { args: NoArgs; result: SkillLibrary };
  set_skill_library_dirs: { args: { dirs: string[] }; result: SkillLibrary };
  add_library_skill: { args: { agentId: string; path: string; mode: LibraryAddMode }; result: Skill };
  /** リンク先・ライブラリのフォルダを OS のファイラで開く */
  reveal_skill_folder: { args: { path: string }; result: null };
  create_channel: { args: { name: string; topic: string; memberIds: string[] }; result: Channel };
  update_channel: { args: { id: string; name: string; topic: string }; result: Channel };
  delete_channel: { args: { id: string }; result: null };
  add_channel_member: { args: { channelId: string; memberId: string }; result: null };
  remove_channel_member: { args: { channelId: string; memberId: string }; result: null };
  /** seq の昇順。limit の既定は 50、上限は 200 */
  list_messages: { args: { channelId: string; beforeSeq: number | null; limit: number | null }; result: Message[] };
  /** 画像・ファイルだけの発言は content が空でよい */
  send_message: { args: { channelId: string; content: string; attachments: AttachmentInput[] }; result: Message };
  /** 発言に添えた画像を data URL で返す */
  get_attachment: { args: { messageId: string; attachmentId: string }; result: string };
  /** 発言に添えたファイルを OS のファイラで表示する（ファイルを選んだ状態で開く） */
  reveal_attachment: { args: { messageId: string; attachmentId: string }; result: null };
  /** 実行中の割り振りも打ち切る */
  stop_channel: { args: { channelId: string }; result: null };
  /** そのチャンネルの割り振り（createdAt の昇順、新しい方から最大200件） */
  list_delegations: { args: { channelId: string }; result: Delegation[] };
  update_profile: { args: { profile: Profile }; result: Profile };
  /** ランナーに probe を送る。結果は state-changed で届く */
  backend_api_key: { args: { backendId: string; action: 'status' | 'set' | 'delete'; key?: string }; result: string };
  refresh_backends: { args: NoArgs; result: null };
  /** ログインを始め、利用者が終える（窓が閉じる）まで待つ。終わった後の状態は state-changed で届く */
  login_backend: { args: { backendId: string }; result: null };
  get_storage_info: { args: NoArgs; result: StorageInfo };
  choose_folder: { args: NoArgs; result: string | null };
  /** 成功するとアプリが再起動する */
  change_data_dir: { args: { path: string; mode: DataDirMode }; result: null };
  reveal_data_dir: { args: NoArgs; result: null };
  restart_app: { args: NoArgs; result: null };
  /** OS の既定のブラウザでリンクを開く（http・https だけ。それ以外は validation） */
  open_url: { args: { url: string }; result: null };
}

export type CommandName = keyof CommandMap;
export type CommandArgs<C extends CommandName> = CommandMap[C]['args'];
export type CommandResult<C extends CommandName> = CommandMap[C]['result'];

/** 引数なしのコマンドは引数を省略できる */
export type InvokeRest<C extends CommandName> = keyof CommandArgs<C> extends never ? [] : [args: CommandArgs<C>];

/** 復旧モード（design.md §11）でも動くコマンド。ほかは unavailable で失敗する */
export const RECOVERY_COMMANDS = [
  'get_boot_status',
  'get_storage_info',
  'choose_folder',
  'change_data_dir',
  'reveal_data_dir',
  'restart_app',
  'open_url',
] as const satisfies readonly CommandName[];

export interface SkillsChanged {
  agentId: string;
}

/** イベント名 → ペイロード（Rust → React） */
export interface EventMap {
  /** 新しい発言が保存されるたび（人間の発言も含めてすべて） */
  'message-created': Message;
  /** 実行中の表示・待機数が変わるたび（全体の最新状態） */
  'activity-changed': ActivityState;
  /** エージェント・チャンネル・プロフィール・バックエンド・ランナー状態が変わった。get_snapshot を取り直す */
  'state-changed': null;
  /** そのエージェントのスキルが変わった */
  'skills-changed': SkillsChanged;
  /** ライブラリのフォルダ指定が変わった。get_skill_library を取り直す（フォルダの中身の変化は監視しない） */
  'skill-library-changed': null;
  /** 割り振りが作られた・サブタスクや全体の状態が変わった（全体の最新の値。React は id で置き換える） */
  'delegation-changed': Delegation;
}

export type EventName = keyof EventMap;
export type EventPayload<E extends EventName> = EventMap[E];

/** 先に購読しておくイベントの一覧（起動時に全部購読してから get_boot_status を呼ぶ） */
export const EVENT_NAMES = [
  'message-created',
  'activity-changed',
  'state-changed',
  'skills-changed',
  'skill-library-changed',
  'delegation-changed',
] as const satisfies readonly EventName[];
