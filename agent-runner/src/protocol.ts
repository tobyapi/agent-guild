// Rust(Tauri) ⇄ agent-runner(sidecar) の標準入出力プロトコル（1行1 JSON）。
// アプリに同梱して同時に出荷する「内部契約」。Rust は ready.protocolVersion の完全一致だけを確認する。
// 実例は contracts/runner/*.jsonl。Rust 側の対応は src-tauri/crates/runner-client。
//
// 規則:
// - run ごとに終端イベント（result か error）を必ずちょうど1回返す。
//   cancel されたら error{code:'cancelled'} を返す（中断が間に合わず完了したなら result でよい）。
// - run は終端イベントの前に post（作業の途中の投稿）を 0 回以上返してよい。終端イベントのあとは送らない。
// - 未知の type の要求: id があれば error{code:'bad_request'} を返し、なければ stderr に記録して無視する。
// - 受け手は未知のフィールドを無視する。Rust は未知のイベントを無視し、id が null の error はログに残すだけ。
// - stdin が EOF になったら、全実行を中断して終了する（親が落ちても孤児にならない）。
// - stdout はプロトコル専用。console.log などは起動時に stderr へ向ける。
// - 権限は「その効果を許すか」。false の効果をそのプラットフォームで確実に防げないなら、
//   黙って実行せず error{code:'unsupported_permission'} で拒否する。
//   例外: 作業場所の MEMORY.md は writeFiles に関係なくいつでも読み書きさせる。1ファイルに絞れないプラットフォームでは
//   作業場所への書き込みを許し、MEMORY.md 以外を書かないことはエージェントがルール（プロンプト）を守ることに任せる。

export const PROTOCOL_VERSION = 1;

export type PermissionKey =
  | 'webSearch'
  | 'webFetch'
  | 'readFiles'
  | 'writeFiles'
  | 'writeAnywhere'
  | 'runCommands'
  | 'skills';
export type Permissions = Record<PermissionKey, boolean>;

/**
 * 「when の権限を許すなら、requires の権限もすべて必要」という規則。アダプタが守れない権限の組み合わせを申告し、
 * Rust はエージェントの保存時に実効権限で検証し、React は編集画面で知らせる。
 */
export interface PermissionRule {
  when: PermissionKey;
  requires: PermissionKey[];
}

export type BackendStatus = 'ready' | 'needs_auth' | 'unavailable';

export interface OptionSpec {
  key: string;
  label: string;
  description: string;
  type: 'string' | 'number' | 'boolean' | 'select';
  choices: string[];
  default: string | number | boolean | null;
}

/** 作業の途中の投稿のしかた: 'tool' は投稿用のツール（post）、'text' はツールを使う前の文章。Rust はプロンプトの案内を変える */
export type MidRunPost = 'tool' | 'text';

/**
 * 選べるモデル（id は run の model に渡す値、description はなければ空）。React はモデルと推論の深さの選択肢に使い、
 * Rust は保存時に深さがそのモデルで選べるかを確かめる。efforts は選べる深さ（浅い順。空なら選べない）、
 * defaultEffort は深さを選ばないときの深さ（null はバックエンドに任せる）
 */
export interface ModelSpec {
  id: string;
  label: string;
  description: string;
  efforts: string[];
  defaultEffort: string | null;
}

/** backendOptions の推論の深さのキー（値は、選んだモデルの ModelSpec.efforts のどれか） */
export const EFFORT_OPTION = 'effort';

export interface BackendInfo {
  id: string;
  label: string;
  /** 選べるモデル（分からなければ空。そのときモデルは自由入力で、深さは選べない） */
  models: ModelSpec[];
  /** モデルを選ばないときに使うモデル（空ならバックエンドに任せる） */
  defaultModel: string;
  /** そもそも提供できる能力 */
  capabilities: Permissions;
  status: BackendStatus;
  statusMessage: string;
  /** backendOptions の項目定義 */
  options: OptionSpec[];
  /** 守れない権限の組み合わせ（この規則に反する run は unsupported_permission で拒否される） */
  permissionRules: PermissionRule[];
  /** どれかの組をすべて許すと、PC のどのファイルでも読めて外へも送れる（資料に紛れた指示で持ち出されうる。React が知らせる） */
  leakRisks: PermissionKey[][];
  /** アプリからログインを始められる（login 要求を受け付ける） */
  canLogin: boolean;
  /** 作業の途中でチャットに投稿する方法（途中では投稿できないなら null） */
  midRunPost: MidRunPost | null;
}

export interface SkillPayload {
  name: string;
  description: string;
  /** SKILL.md の本文（frontmatter を除く）。アダプタはこれと name / description から SKILL.md を書く */
  body: string;
  /** ライブラリにリンクしたスキルのフォルダ（絶対パス。null ならアプリ内）。アダプタは SKILL.md 以外の付属ファイル（scripts/ など）も
   * 展開先へコピーする（SKILL.md・.git・node_modules・シンボリックリンクは除く。合計 50MB・2000 ファイルまで。超えたら error{bad_request}） */
  dir: string | null;
}

/** run に添える画像（会話に貼られたもの）。アダプタは SDK の画像入力として渡す */
export interface ImagePayload {
  /** 画像ファイルの絶対パス（データフォルダの attachments/ の中。エージェントの読み取り権限とは関係なく読む） */
  path: string;
  /** image/png・image/jpeg・image/gif・image/webp のどれか */
  mediaType: string;
}

export type ErrorCode =
  | 'auth' // 認証がない・失敗した
  | 'rate_limit'
  | 'model_not_found'
  | 'cancelled'
  | 'unknown_backend'
  | 'unsupported_permission' // 要求された制限を守れない
  | 'bad_request' // 不正なリクエスト・未知の type
  | 'internal';

/** Rust → runner */
export type RunnerRequest =
  | {
      type: 'run';
      id: string;
      backend: string;
      /** エージェントの作業場所（cwd。絶対パス）。書き込みはここだけ */
      workspace: string;
      /** アダプタの管理領域（スキルの展開・人格ファイル・SDK 設定など）。エージェントからは書けない */
      stateDir: string;
      /** 追加で読み取りを許すフォルダ（相談元の作業場所など） */
      readableDirs: string[];
      systemPrompt: string;
      prompt: string;
      /** 操作の確認に使う、信頼できる依頼の情報（人間の依頼・エージェントの役割とできること。資料や仲間の発言は入らない） */
      intent: string;
      /** 空文字ならバックエンド既定 */
      model: string;
      permissions: Permissions;
      /** SDK ごとの置き場所への展開はアダプタの責務 */
      skills: SkillPayload[];
      /** 応える発言と会話の起点に貼られた画像（発言の順）。なければ空 */
      images: ImagePayload[];
      /** Agent.backendOptions。知らないキーは無視する。EFFORT_OPTION（effort）は推論の深さ */
      options: Record<string, unknown>;
    }
  | { type: 'cancel'; id: string }
  /** バックエンドの状態（認証など）を確認し直して backends を送る */
  | { type: 'apiKey'; id: string; backend: 'grok' | 'muse'; action: 'status' | 'set' | 'delete'; key?: string }
  | { type: 'probe' }
  /** ログインを始める（canLogin のものだけ）。終わったら backends を送り、result（text は空）か error で終える。cancel で打ち切れる */
  | { type: 'login'; id: string; backend: string }
  | { type: 'shutdown' };

/** runner → Rust */
export type RunnerEvent =
  | { type: 'ready'; protocolVersion: number; runnerVersion: string; backends: BackendInfo[] }
  | { type: 'backends'; backends: BackendInfo[] }
  | { type: 'activity'; id: string; detail: string }
  /** 作業の途中の投稿（チャットにそのまま出す文章。振り分けはしない） */
  | { type: 'post'; id: string; text: string }
  | { type: 'result'; id: string; text: string }
  | { type: 'error'; id: string | null; code: ErrorCode; message: string };
