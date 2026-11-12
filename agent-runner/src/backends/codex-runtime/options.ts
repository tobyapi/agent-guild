// run 要求 → Codex SDK の設定（Codex の config の上書きとスレッドのオプション）と、守れない権限の判定。
// 権限の判断は Windows で実際に確かめた Codex の sandbox の挙動に基づく（workspace-write は作業場所の外への書き込みを
// 拒否する。ただし既定では一時フォルダにも書けるので除外する）。書き込みを許していなくても workspace-write にする
// （作業場所の MEMORY.md はいつでも書けるようにし、ほかのファイルを書かないことはエージェントがルールを守ることに任せる）。
// 作業場所の外への書き込み（writeAnywhere）は sandbox を外して行う（danger-full-access）。外すとネットワークも止められない。
// 指定フォルダのチャンネルでは、sandbox の指定のかわりに権限プロファイルを使う（./folder-profile.ts）。

import type { CodexOptions, Input, ThreadOptions } from '@openai/codex-sdk';
import { SECRET_ENV_GLOBS } from '../agent-env.ts';
import { EFFORT_OPTION, type PermissionKey, type PermissionRule, type Permissions } from '../../protocol.ts';
import {
  brokenRule,
  declaredRules,
  EMPTY_CATALOG,
  optionChoice,
  type ExplainedRule,
  type ModelCatalog,
  type RunRequest,
} from '../types.ts';
import { CODEX_EFFORTS, defaultEffortOf } from './models.ts';
import { t } from './texts/index.ts';

/** developer_instructions はコマンドライン引数で渡るので、Windows のコマンドラインの上限（32767 文字）に収める */
export const MAX_SYSTEM_PROMPT_LENGTH = 24_000;

export function codexConfig(request: RunRequest): NonNullable<CodexOptions['config']> {
  return {
    // 人格は developer メッセージとして渡す（Codex SDK にシステムプロンプトの引数はない）
    developer_instructions: request.systemPrompt,
    // 作業場所の AGENTS.md は読まない（エージェントが書き換えて次の実行に影響させないため）
    project_doc_max_bytes: 0,
    // 書き込みは作業場所だけ（既定では TMPDIR と /tmp にも書ける）
    sandbox_workspace_write: { exclude_tmpdir_env_var: true, exclude_slash_tmp: true },
    // コマンドには秘密らしい環境変数を渡さない（Codex 自身は認証に使うので、Codex のプロセスには渡す）
    shell_environment_policy: { exclude: [...SECRET_ENV_GLOBS] },
  };
}

/**
 * readableDirs は渡さない: Codex の additionalDirectories は workspace-write で「書ける」場所になってしまい、
 * 一方で読み取りは sandbox がどこでも許すので、渡さなくても読める。
 * モデルと推論の深さは、選んでいなければモデルの一覧（catalog）の既定を明示して渡す（Codex の config.toml の既定は使わない）
 */
export function threadOptions(request: RunRequest, catalog: ModelCatalog = EMPTY_CATALOG): ThreadOptions {
  const { permissions } = request;
  const model = request.model || catalog.defaultModel;
  const fallbackEffort = { [EFFORT_OPTION]: defaultEffortOf(catalog, model) };
  // 指定フォルダでは、読み書きの範囲と通信を権限プロファイルで決める（sandbox の指定とは併用できない）
  const folder = request.writableDirs !== undefined;
  return {
    workingDirectory: request.workspace,
    skipGitRepoCheck: true,
    sandboxMode: folder ? undefined : sandboxModeOf(permissions),
    approvalPolicy: 'never',
    webSearchMode: permissions.webSearch ? 'live' : 'disabled',
    // Codex に Web 閲覧の専用ツールはなく、ページの取得はネットワーク越しのコマンドで行う（webFetch のときだけ開く）
    networkAccessEnabled: folder ? undefined : permissions.webFetch,
    model: model || undefined,
    modelReasoningEffort:
      optionChoice(request.options, EFFORT_OPTION, CODEX_EFFORTS) ??
      optionChoice(fallbackEffort, EFFORT_OPTION, CODEX_EFFORTS),
  };
}

/** 本文と添付画像（発言の順）。Codex は画像をファイルのまま読む（sandbox の読み取りの制限とは関係ない） */
export function threadInput(request: RunRequest): Input {
  if (request.images.length === 0) return request.prompt;
  const images = request.images.map(({ path }) => ({ type: 'local_image' as const, path }));
  return [{ type: 'text', text: request.prompt }, ...images];
}

/**
 * 作業場所の中は workspace-write、作業場所の外にも書くなら sandbox を外す。書き込みを許していなくても workspace-write にする:
 * 作業場所の MEMORY.md はいつでも書けるようにしたいが、sandbox は1ファイルに絞れないので、ほかのファイルを書かないことは
 * エージェントがルール（プロンプト）を守ることに任せる
 */
function sandboxModeOf(permissions: Permissions): ThreadOptions['sandboxMode'] {
  return permissions.writeFiles && permissions.writeAnywhere ? 'danger-full-access' : 'workspace-write';
}

/**
 * 守れない権限の組み合わせ（下の unenforceableReason を参照）。書き込みを許すなら、コマンドの実行も許す必要がある。
 * 作業場所の外への書き込みは sandbox を外すので、ネットワーク（webFetch）も止められない。
 */
const rules = (): readonly ExplainedRule[] => [
  // 理由は画面に出るので、使うときの言語で作る
  { when: 'writeFiles', requires: ['runCommands'], reason: t('ruleWrite') },
  { when: 'writeAnywhere', requires: ['writeFiles', 'webFetch'], reason: t('ruleWriteAnywhere') },
];

/** 申告する権限の規則（BackendInfo.permissionRules） */
export const PERMISSION_RULES: readonly PermissionRule[] = declaredRules(rules());

/**
 * 持ち出しの危険がある組（BackendInfo.leakRisks）。sandbox はどこでも読めて、コマンドの実行は止められないので、
 * Web 閲覧（sandbox のネットワークを開ける）を許すだけで、ファイルを読んで外へ送れる
 */
export const LEAK_RISKS: readonly (readonly PermissionKey[])[] = [['webFetch']];

/**
 * 役割で許可していなくても止められない操作（BackendInfo.unrestricted）。Codex は作業にシェルを使い、sandbox は作業場所への
 * 書き込みを許す（MEMORY.md のため）。読み取り先は、macOS・Linux と Windows の elevated 版の隔離でしか絞れない
 * （Windows の標準の隔離では「Restricted read-only access requires the elevated Windows sandbox backend」で拒否される）
 * ので、絞らない。外への書き込みとネットワークは sandbox が止める
 */
export const UNRESTRICTED: readonly PermissionKey[] = ['readAnywhere', 'writeFiles', 'runCommands'];

/**
 * Codex で守れない権限の組み合わせなら、その理由。Codex は作業にシェルを使うので、コマンドの実行そのものは止められない。
 * 書き込みを許していないときも、MEMORY.md のために作業場所へは書ける（ほかのファイルを書かないのはエージェントに任せる）。
 * ネットワークは webFetch のときだけ開く。指定フォルダ（folder）では、利用者全体のスキルの場所を読めないので、スキルは問わない。
 */
export function unenforceableReason(permissions: Permissions, folder = false): string | null {
  if (!permissions.readFiles) return t('cannotStopReads');
  if (!permissions.skills && !folder) return t('cannotStopSkills');
  return brokenRule(rules(), permissions)?.reason ?? null;
}
