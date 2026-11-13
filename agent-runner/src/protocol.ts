// Rust(Tauri) ⇄ agent-runner(sidecar) の標準入出力プロトコル（1行1 JSON）。
// アプリに同梱して同時に出荷する「内部契約」。Rust は ready.protocolVersion の完全一致だけを確認する。
// 実例は contracts/runner/*.jsonl。Rust 側の対応は src-tauri/crates/runner-client。
//
// 規則:
// - run ごとに終端イベント（result か error）を必ずちょうど1回返す。
//   cancel されたら error{code:'cancelled'} を返す（中断が間に合わず完了したなら result でよい）。
// - probe は id を必須とし、backends の更新後に同じ id の result（text は空）か error を返す。
// - run は終端イベントの前に post（作業の途中の投稿）を 0 回以上返してよい。終端イベントのあとは送らない。
// - 未知の type の要求: id があれば error{code:'bad_request'} を返し、なければ stderr に記録して無視する。
// - 受け手は未知のフィールドを無視する。Rust は未知のイベントを無視し、id が null の error はログに残すだけ。
// - stdin が EOF になったら、全実行を中断して終了する（親が落ちても孤児にならない）。
// - stdout はプロトコル専用。console.log などは起動時に stderr へ向ける。
// - run の permissions は役割で決まる権限で、どのバックエンドにも同じものが届く（「その効果を許すか」）。
//   ランナーは、その中でバックエンドが守って使える操作だけをアダプタに渡す（capabilities と permissionRules で
//   取り除く。許可を足すことはしない）。それでも false の効果を確実に防げない組み合わせが残るなら、
//   黙って実行せず error{code:'unsupported_permission'} で拒否する。
//   例外: 作業場所の MEMORY.md は writeFiles に関係なくいつでも読み書きさせる。1ファイルに絞れないプラットフォームでは
//   作業場所への書き込みを許し、MEMORY.md 以外を書かないことはエージェントがルール（プロンプト）を守ることに任せる。

export const PROTOCOL_VERSION = 4;

import type { BackendSetup, FolderScope } from './protocol-backend.ts';
import type { ImagePayload, SkillPayload } from './protocol-payloads.ts';

export type { ApiKeySpec, BackendSetup, FolderScope, InstallGuide, LoginSpec, StartSpec } from './protocol-backend.ts';
export type { ImagePayload, SkillFilePayload, SkillPayload } from './protocol-payloads.ts';

export type PermissionKey =
  'webSearch' | 'webFetch' | 'readFiles' | 'readAnywhere' | 'writeFiles' | 'writeAnywhere' | 'runCommands' | 'skills';
export type Permissions = Record<PermissionKey, boolean>;

/**
 * 「when の操作は、requires もすべて許されているときだけ使える」という規則。アダプタが、単独では守れない操作
 * （隔離できないコマンドの実行など）を申告する。ランナー・Rust・React は同じ規則で、役割の権限から使えない操作を取り除く
 * （権限そのものは変えない。Rust はプロンプトの「できること」に、React は編集画面の表示に使う）。
 */
export interface PermissionRule {
  when: PermissionKey;
  requires: PermissionKey[];
}

/** 表示の言語。起動時は環境変数 GUILD_LANGUAGE（なければ・知らない値なら ja）、以後は setLanguage で変わる */
export type Language = 'ja' | 'en' | 'zh-Hans' | 'zh-Hant' | 'ko';

export type BackendStatus = 'ready' | 'needs_auth' | 'stopped' | 'unavailable';

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
  /** アプリがOllamaへ道具を提供できるか（native または JSON）。省略時は非対応。 */
  tools?: boolean;
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
  /** このバックエンドが道具として持つ操作（ない操作は、権限があっても使えない） */
  capabilities: Permissions;
  status: BackendStatus;
  statusMessage: string;
  /** backendOptions の項目定義 */
  options: OptionSpec[];
  /** 単独では守れない操作の規則（run の権限からこの規則に反する操作を取り除いて実行する） */
  permissionRules: PermissionRule[];
  /** どれかの組をすべて許すと、PC のどのファイルでも読めて外へも送れる（資料に紛れた指示で持ち出されうる。React が知らせる） */
  leakRisks: PermissionKey[][];
  /**
   * 役割で許可していなくても、このバックエンドでは止められない操作（OS の隔離の中では行える。React が編集画面で知らせる）。
   * 権限は役割で決まり、どのバックエンドでも同じだが、ここに挙げた操作だけは役割の権限より広く動きうる
   */
  unrestricted: PermissionKey[];
  /** 作業の途中でチャットに投稿する方法（途中では投稿できないなら null） */
  midRunPost: MidRunPost | null;
  /** 指定フォルダのチャンネルでの範囲の守り方（指定フォルダでは実行できないなら null） */
  folderScope: FolderScope | null;
  /**
   * 道具を使うかどうかを切り替える設定（options にある真偽値の項目の key）。null なら役割の権限どおりに使う。
   * key があるときは、その設定が true で、選んだモデルが道具に対応している（ModelSpec.tools）ときだけ使う
   */
  toolsOption: string | null;
  /** この PC の中で動く（API の利用料がかからない） */
  local: boolean;
  /** このバックエンドでアイコンの枠を生成できる（Rust と React はこの申告だけを見る） */
  frameGeneration: boolean;
  /** アプリからのセットアップ（インストール・起動・ログイン・API キー）のうち、このバックエンドでできること */
  setup: BackendSetup;
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
      /** Present only for a restricted folder channel. Additional writable roots. */
      writableDirs?: string[];
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
  /**
   * 画像を1枚描く（BackendInfo.frameGeneration を申告したアダプタだけ。ほかは error{bad_request}）。権限は持たない:
   * アダプタは画像を生成する道具と、添えたスキルの手順に要る道具（作業場所の中だけに書けるコマンド・画像を見る道具）だけを
   * 使わせる（ネットワーク・Web なし）。始める前に output の前の残りを消し、終わったときに output に PNG がなければ生成した
   * 画像を書いてから result（text は空）で終える。画像ができなかったら error（理由はいまの言語）。cancel で打ち切れる
   */
  | {
      type: 'image';
      id: string;
      backend: string;
      /** cwd（絶対パス。書き込みはここだけ） */
      workspace: string;
      /** アダプタの管理領域 */
      stateDir: string;
      /** 空なら足さない */
      systemPrompt: string;
      prompt: string;
      /** 描くときに従うスキル（run の skills と同じ形と展開。枠の生成では内蔵スキル ornate-avatar-frame。なければ []） */
      skills: SkillPayload[];
      /** 出来上がった PNG の絶対パス（Rust が決める。作業場所の中に置き、プロンプトで保存先として伝える） */
      output: string;
    }
  | { type: 'cancel'; id: string }
  /** バックエンドの状態（認証など）を確認し直して backends を送る */
  | { type: 'apiKey'; id: string; backend: string; action: 'status' | 'set' | 'delete'; key?: string }
  | { type: 'backendAuthMode'; id: string; backend: string; mode: 'desktop' | 'api' }
  | { type: 'probe'; id: string }
  /** ログインを始める（setup.login のあるものだけ）。終わったら backends を送り、result（text は空）か error で終える。cancel で打ち切れる */
  | { type: 'login'; id: string; backend: string }
  /** ランナーが作る文字列（BackendInfo の説明・途中経過・エラー）の言語を変え、backends を送り直す。id も返事もない */
  | { type: 'setLanguage'; language: Language }
  | { type: 'shutdown' };

/** 取得できた使用量の増分。model は主モデル名。費用の単位は 10 億分の 1 米ドル。 */
export interface RunUsage {
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
  estimatedCostNanoUsd?: number;
}

/** runner → Rust */
export type RunnerEvent =
  | { type: 'ready'; protocolVersion: number; runnerVersion: string; backends: BackendInfo[] }
  | { type: 'backends'; backends: BackendInfo[] }
  | { type: 'activity'; id: string; detail: string }
  /** 作業の途中の投稿（チャットにそのまま出す文章。振り分けはしない） */
  | { type: 'post'; id: string; text: string }
  | { type: 'usage'; id: string; usage: RunUsage }
  | { type: 'result'; id: string; text: string }
  | { type: 'error'; id: string | null; code: ErrorCode; message: string };
