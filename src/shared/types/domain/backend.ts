import type { PermissionKey, Permissions } from './permissions';

/** バックエンドID。ランナーが申告したもの。画面は ID で分岐せず、BackendInfo の申告だけを見る */
export type BackendId = string;

export type BackendStatus = 'ready' | 'needs_auth' | 'stopped' | 'unavailable';

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
  /** アプリがこのモデルへ道具を提供できるか（BackendInfo.toolsOption のあるバックエンドで使う）。省略時は非対応 */
  tools?: boolean;
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
  /**
   * 持ち出しの危険がある権限の組。どれかの組をすべて許すと、このパソコンのどのファイルでも読めて外へも送れる
   * （資料に紛れた指示で中身を持ち出されうる）。編集画面で知らせる（保存は止めない）
   */
  leakRisks: PermissionKey[][];
  /** 役割で許可していなくても、このバックエンドでは止められない操作（編集画面で知らせる。権限そのものは役割で決まる） */
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
  /** このバックエンドでアイコンの枠を生成できる（generate_avatar_frame。ID では選り分けない） */
  frameGeneration: boolean;
  /** アプリからのセットアップ（インストール・起動・ログイン・API キー）のうち、このバックエンドでできること */
  setup: BackendSetup;
}

/**
 * 指定フォルダの範囲の守り方。files = ファイルの道具ごとに範囲を確かめる（コマンドとスキルは使えない）、
 * sandbox = シェルごと OS の隔離に入れる（コマンドも範囲の中で使える）
 */
export type FolderScope = 'files' | 'sandbox';

export interface BackendSetup {
  /** 使えない（unavailable）ときに出す、CLI のインストールの案内（install_backend_cli。なければ null） */
  install: InstallGuide | null;
  /** 止まっている（stopped）ときに、アプリから起動できる（start_backend。できないなら null） */
  start: StartSpec | null;
  /** アプリからログインを始められる（login_backend。できないなら null） */
  login: LoginSpec | null;
  /** アプリに API キーを保存できる（backend_api_key。できないなら null） */
  apiKey: ApiKeySpec | null;
}

/** CLI の公式インストーラー（macOS・Linux 用のシェルスクリプト） */
export interface InstallGuide {
  /** 入れる CLI の名前（例: 「Claude Code」） */
  cli: string;
  /** 配布元（例: 「Anthropic」） */
  publisher: string;
  /** インストーラーの URL（https） */
  scriptUrl: string;
  /** インストーラーを実行するシェル（絶対パス） */
  shell: string;
  /** 入る実行ファイルの名前 */
  binary: string;
  /** インストーラーに渡す環境変数 */
  env: Record<string, string>;
  /** 公式の手順のページ */
  docsUrl: string;
  /** ターミナルからログインするときのコマンド */
  loginCommand: string;
}

export interface StartSpec {
  /** 起動する macOS のアプリ（bundle ID） */
  macBundleId: string;
}

export interface LoginSpec {
  /** ログインのボタンの文言 */
  label: string;
  /** ログインを待っている間の案内 */
  waiting: string;
}

export interface ApiKeySpec {
  /** 保存したキーがないときに使う環境変数の名前 */
  envVar: string;
}

export type RuntimeState = 'starting' | 'ready' | 'unavailable';

export interface RuntimeStatus {
  state: RuntimeState;
  message: string;
}
