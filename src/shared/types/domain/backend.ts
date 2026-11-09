import type { PermissionKey, Permissions } from './permissions';

/** バックエンドID。ランナーが申告したもの（'claude' | 'codex' | 将来の追加分） */
export type BackendId = string;

export type BackendStatus = 'ready' | 'needs_auth' | 'unavailable';

/** バックエンド固有設定の項目定義。React はこれから汎用フォームを描く */
export interface OptionSpec {
  key: string;
  label: string;
  description: string;
  type: 'string' | 'number' | 'boolean' | 'select';
  /** type が select のときの選択肢 */
  choices: string[];
  default: string | number | boolean | null;
}

/** 「when の権限を使うなら、requires の権限もすべて必要」。バックエンドが守れない権限の組み合わせ */
export interface PermissionRule {
  when: PermissionKey;
  requires: PermissionKey[];
}

/**
 * 作業の途中でチャットに投稿する方法。'tool' は投稿用のツール（post）を呼ぶ、
 * 'text' はツールを使う前に書いた文章がそのまま投稿される。Rust がプロンプトの案内に使う
 */
export type MidRunPost = 'tool' | 'text';

/**
 * 選べるモデル（id は Agent.model に保存する値）。efforts は選べる推論の深さ（浅い順。空なら選べない）、
 * defaultEffort は深さを選ばないときの深さ（null はバックエンドに任せる）
 */
export interface ModelSpec {
  id: string;
  label: string;
  description: string;
  efforts: string[];
  defaultEffort: string | null;
}

/** Agent.backendOptions の推論の深さのキー（値は、選んだモデルの ModelSpec.efforts のどれか） */
export const EFFORT_OPTION = 'effort';

export interface BackendInfo {
  id: BackendId;
  label: string;
  /** 選べるモデル（分からなければ空。そのときモデルは自由入力で、深さは選べない） */
  models: ModelSpec[];
  /** モデルを選ばないときに使うモデル（空ならバックエンドに任せる） */
  defaultModel: string;
  /** バックエンドがそもそも提供できる能力 */
  capabilities: Permissions;
  status: BackendStatus;
  /** status が ready 以外のときの案内（例: 「ターミナルで codex login を実行してください」） */
  statusMessage: string;
  options: OptionSpec[];
  /** 実効権限がこの規則に反するエージェントは保存できない（validation）。編集画面でも知らせる */
  permissionRules: PermissionRule[];
  /** アプリからログインを始められる（login_backend） */
  canLogin: boolean;
  /** 作業の途中でチャットに投稿する方法（途中では投稿できないなら null） */
  midRunPost: MidRunPost | null;
}

export type RuntimeState = 'starting' | 'ready' | 'unavailable';

export interface RuntimeStatus {
  state: RuntimeState;
  message: string;
}
