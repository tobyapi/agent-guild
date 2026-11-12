// プロトコルの型のうち、バックエンドごとの違いの申告（BackendInfo の folderScope と setup）。protocol.ts から再公開する。
// Rust（runner-client の protocol/setup.rs）と同じ JSON。

/**
 * 指定フォルダの範囲の守り方。files = ファイルの道具ごとに範囲を確かめる（コマンドとスキルは使えない）、
 * sandbox = シェルごと OS の隔離に入れる（コマンドも範囲の中で使える）
 */
export type FolderScope = 'files' | 'sandbox';

export interface BackendSetup {
  /** 使えない（unavailable）ときに出す、CLI のインストールの案内（なければ null） */
  install: InstallGuide | null;
  /** 止まっている（stopped）ときに、アプリから起動できる（できないなら null） */
  start: StartSpec | null;
  /** アプリからログインを始められる（login 要求を受け付ける。できないなら null） */
  login: LoginSpec | null;
  /** アプリに API キーを保存できる（apiKey 要求を受け付ける。できないなら null） */
  apiKey: ApiKeySpec | null;
}

/** CLI の公式インストーラー（macOS・Linux 用のシェルスクリプト）。Rust が取得して実行する */
export interface InstallGuide {
  /** 入れる CLI の名前（例: 「Claude Code」） */
  cli: string;
  /** 配布元（例: 「Anthropic」） */
  publisher: string;
  /** インストーラーの URL（https） */
  scriptUrl: string;
  /** インストーラーを実行するシェル（絶対パス） */
  shell: string;
  /** 入る実行ファイルの名前（~/.local/bin の中。あればインストール済みとみなす） */
  binary: string;
  /** インストーラーに渡す環境変数。値の `{bin}` はインストール先（~/.local/bin）に置き換わる */
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
