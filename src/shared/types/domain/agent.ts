import type { BackendId } from './backend';
import type { Permissions } from './permissions';

/**
 * メンションのない人間の発言への反応。上の段に1人でも（ready な）該当者がいれば、下の段の人は答えない。
 * - lead: 最初に受ける（マネージャーや受付。lead がいるチャンネルでは、メンションのない依頼は lead だけが受ける）
 * - answer: 答える（lead がいなければ、answer の全員が順に答える）
 * - fallback: lead も answer もいないときだけ答える
 * - ignore: 答えない（メンションされたとき・割り振られたときだけ話す）
 */
export type UnmentionedPolicy = 'lead' | 'answer' | 'fallback' | 'ignore';

export interface Agent {
  id: string;
  /** 1〜32文字。空白と @ は不可。正規化（NFKC・大文字小文字無視）して他のエージェントや人間と重複不可 */
  name: string;
  /** 絵文字、または data:image/... の画像 */
  avatar: string;
  color: string;
  /** 先頭は固定権限を決める役割とサイドバーの区分。残りは分類用（全体で0〜8個、各1〜16文字） */
  tags: string[];
  role: string;
  personality: string;
  tone: string;
  /** 得意分野。相談相手の一覧やプロンプトに出る（空でもよい） */
  expertise: string;
  backend: BackendId;
  /** 空文字ならバックエンドの既定モデル */
  model: string;
  /** バックエンド固有の設定。キーと型は BackendInfo.options が定める */
  backendOptions: Record<string, unknown>;
  /** 役割から算出する固定権限。保存・Snapshot・実行時にバックエンドの能力と依存関係で絞る */
  permissions: Permissions;
  unmentioned: UnmentionedPolicy;
  /** 他のエージェントにメンションされたら、チャンネル外からでも参加して答える（相談相手になる） */
  consultable: boolean;
  /** tasks ブロックでタスクを割り振れる（マネージャー。design.md §7.1） */
  canDelegate: boolean;
  autonomyEnabled: boolean;
  /** 5 以上 */
  autonomyIntervalMin: number;
  autonomyChannelId: string | null;
  lastAutonomousAt: number | null;
  createdAt: number;
  /** 論理削除。null 以外は削除済み（一覧には出さず、過去の発言の表示にだけ使う） */
  deletedAt: number | null;
}

export type AgentInput = Omit<Agent, 'id' | 'createdAt' | 'lastAutonomousAt' | 'deletedAt'>;

/**
 * テンプレートの見た目のアクセント。トークン `--kind-<accent>` と `--kind-<accent>-soft` の名前に対応する（例: 'worker' → --kind-worker）。
 * React は値で分岐せず、CSS 変数を組み立てるだけ（トークンがなければ中立の色に落ちる）。null は中立。
 */
export type TemplateAccent = string | null;

/**
 * エージェント作成時のテンプレート（Rust の guild-domain が唯一の定義。Snapshot.templates で届く）。
 * 権限は作成後も先頭タグに対応する役割で固定する。他の項目は作成時の既定値。
 */
export interface AgentTemplate {
  id: string;
  label: string;
  description: string;
  accent: TemplateAccent;
  defaults: AgentTemplateDefaults;
}

export interface AgentTemplateDefaults {
  tags: string[];
  /** 担当（Agent.role）の書き出し */
  role: string;
  /** 得意分野の書き出し（空でもよい） */
  expertise: string;
  permissions: Permissions;
  unmentioned: UnmentionedPolicy;
  consultable: boolean;
  canDelegate: boolean;
  autonomyEnabled: boolean;
}
