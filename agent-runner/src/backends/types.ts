// バックエンドアダプタの共通インターフェースと、アダプタ間で共有する部品。
// アダプタ（claude.ts・codex.ts とそのフォルダ）同士は import しない。共通にしたいものはここ・describe.ts・
// environment.ts・executables.ts・skill-files.ts（と skill-files/）に置く。

import { isAbsolute, relative, resolve, sep } from 'node:path';
import type { BackendInfo, ErrorCode, PermissionRule, Permissions, RunnerRequest } from '../protocol.ts';

/** 検証済みの run 要求 */
export type RunRequest = Extract<RunnerRequest, { type: 'run' }>;

/** 状態とモデルの一覧を除いた、アダプタが静的に申告する情報 */
export type BackendDescriptor = Omit<BackendInfo, 'status' | 'statusMessage' | 'models' | 'defaultModel'>;
export type BackendProbe = Pick<BackendInfo, 'status' | 'statusMessage'>;
/** 選べるモデルと、モデルを選ばないときのモデル（probe のたびに聞き直す） */
export type ModelCatalog = Pick<BackendInfo, 'models' | 'defaultModel'>;

/** モデルの一覧が分からないとき（モデルは自由入力、深さは選べない） */
export const EMPTY_CATALOG: ModelCatalog = { models: [], defaultModel: '' };

export interface RunContext {
  /** cancel・shutdown で中断される */
  signal: AbortSignal;
  /** 途中経過（「Web検索: …」など）を Rust へ送る */
  onActivity: (detail: string) => void;
  /** 作業の途中の投稿（チャットに出す文章）を Rust へ送る。終わったジョブの投稿は捨てられる */
  onPost: (text: string) => void;
}

export interface LoginContext {
  /** cancel・shutdown で中断される（ログインの窓を閉じる） */
  signal: AbortSignal;
}

/** バックエンドの実装。新しいバックエンドはこれを実装して registry.ts に1行登録する */
export interface BackendAdapter {
  info(): BackendDescriptor;
  /** 認証などの状態を安価に確かめる。資格情報ファイルや環境変数の「存在」だけを見て、中身は読まない */
  probe(): Promise<BackendProbe>;
  /** 選べるモデルと推論の深さ。なければ EMPTY_CATALOG（probe と一緒に聞き直す） */
  catalog?: () => Promise<ModelCatalog>;
  /** 1回実行して最終テキストを返す。分類できる失敗は BackendError で投げる */
  run(request: RunRequest, context: RunContext): Promise<string>;
  /**
   * ログインを始め、利用者が終える（窓が閉じる）まで待つ。info().canLogin のときだけ呼ばれる。
   * 完了しなかったら BackendError で投げる。終わったあとの状態の確認し直しは Dispatcher が行う
   */
  login?: (context: LoginContext) => Promise<void>;
}

/** プロトコルの ErrorCode つきの失敗 */
export class BackendError extends Error {
  readonly code: ErrorCode;

  constructor(code: ErrorCode, message: string) {
    super(message);
    this.name = 'BackendError';
    this.code = code;
  }
}

/** target が root の中（root 自身を含む）か。Windows では大文字小文字を区別しない（path.relative が扱う） */
export function isInside(target: string, root: string): boolean {
  const rel = relative(resolve(root), resolve(target));
  return rel === '' || (rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel));
}

/** 守れない理由つきの権限の規則。アダプタの中で使い、申告するときは declaredRules で理由を外す */
export interface ExplainedRule extends PermissionRule {
  reason: string;
}

/** 申告する形（BackendInfo.permissionRules）にする */
export function declaredRules(rules: readonly ExplainedRule[]): PermissionRule[] {
  return rules.map(({ when, requires }) => ({ when, requires: [...requires] }));
}

/** 権限が破っている最初の規則（permissionRules）。破っていなければ undefined */
export function brokenRule<R extends PermissionRule>(rules: readonly R[], permissions: Permissions): R | undefined {
  return rules.find((rule) => permissions[rule.when] && rule.requires.some((key) => !permissions[key]));
}

/** false の効果を確実に防げない権限の組み合わせなら、黙って実行せずに拒否する */
export function rejectUnenforceable(backendLabel: string, reason: string | null): void {
  if (reason !== null) throw new BackendError('unsupported_permission', `${backendLabel}: ${reason}`);
}

/** options[key] が候補のどれかならその値。知らないキーや不正な値は無視する */
export function optionChoice<T extends string>(
  options: Record<string, unknown>,
  key: string,
  choices: readonly T[],
): T | undefined {
  const value = options[key];
  return choices.find((choice) => choice === value);
}

/** options[key] が正の整数ならその値 */
export function optionPositiveInt(options: Record<string, unknown>, key: string): number | undefined {
  const value = options[key];
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : undefined;
}

const ERROR_PATTERNS: readonly (readonly [ErrorCode, RegExp])[] = [
  ['auth', /\b401\b|unauthori[sz]ed|authenticat|not logged in|log ?in required|api key/i],
  ['rate_limit', /\b429\b|rate.?limit|quota|usage limit|too many requests/i],
  ['model_not_found', /model.*(not found|does not exist|not supported|unknown)|unknown model/i],
];

/** SDK が文字列でしか返さない失敗を ErrorCode に分類する（分からなければ internal） */
export function classifyErrorText(text: string): ErrorCode {
  return ERROR_PATTERNS.find(([, pattern]) => pattern.test(text))?.[0] ?? 'internal';
}
