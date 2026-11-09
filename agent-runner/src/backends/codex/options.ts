// run 要求 → Codex SDK の設定（Codex の config の上書きとスレッドのオプション）と、守れない権限の判定。
// 権限の判断は Windows で実際に確かめた Codex の sandbox の挙動に基づく（read-only は書き込みとネットワークを拒否し、
// workspace-write は作業場所の外への書き込みを拒否する。ただし既定では一時フォルダにも書けるので除外する）。
// 作業場所の外への書き込み（writeAnywhere）は sandbox を外して行う（danger-full-access）。外すとネットワークも止められない。

import type { CodexOptions, Input, ThreadOptions } from '@openai/codex-sdk';
import type { PermissionRule, Permissions } from '../../protocol.ts';
import { brokenRule, declaredRules, optionChoice, type ExplainedRule, type RunRequest } from '../types.ts';

export const REASONING_EFFORTS = ['low', 'medium', 'high'] as const;
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
  };
}

/**
 * readableDirs は渡さない: Codex の additionalDirectories は workspace-write で「書ける」場所になってしまい、
 * 一方で読み取りは sandbox がどこでも許すので、渡さなくても読める。
 */
export function threadOptions(request: RunRequest): ThreadOptions {
  const { permissions } = request;
  return {
    workingDirectory: request.workspace,
    skipGitRepoCheck: true,
    sandboxMode: sandboxModeOf(permissions),
    approvalPolicy: 'never',
    webSearchMode: permissions.webSearch ? 'live' : 'disabled',
    // Codex に Web 閲覧の専用ツールはなく、ページの取得はネットワーク越しのコマンドで行う（read-only では常に遮断される）
    networkAccessEnabled: permissions.webFetch,
    model: request.model || undefined,
    modelReasoningEffort: optionChoice(request.options, 'reasoningEffort', REASONING_EFFORTS),
  };
}

/** 本文と添付画像（発言の順）。Codex は画像をファイルのまま読む（sandbox の読み取りの制限とは関係ない） */
export function threadInput(request: RunRequest): Input {
  if (request.images.length === 0) return request.prompt;
  const images = request.images.map(({ path }) => ({ type: 'local_image' as const, path }));
  return [{ type: 'text', text: request.prompt }, ...images];
}

/** 書き込みなしは read-only、作業場所の中だけなら workspace-write、作業場所の外にも書くなら sandbox を外す */
function sandboxModeOf(permissions: Permissions): ThreadOptions['sandboxMode'] {
  if (!permissions.writeFiles) return 'read-only';
  return permissions.writeAnywhere ? 'danger-full-access' : 'workspace-write';
}

/**
 * 守れない権限の組み合わせ（下の unenforceableReason を参照）。書き込みを許すなら、コマンドの実行も許す必要がある。
 * 作業場所の外への書き込みは sandbox を外すので、ネットワーク（webFetch）も止められない。
 */
const RULES: readonly ExplainedRule[] = [
  {
    when: 'writeFiles',
    requires: ['runCommands'],
    reason: '書き込みを許すと、作業場所の中でのコマンド（プログラム）の実行を止められません。runCommands も許可してください',
  },
  {
    when: 'writeAnywhere',
    requires: ['writeFiles', 'webFetch'],
    reason:
      '作業場所の外への書き込みは sandbox を外して行うので、ネットワークアクセスも止められません。writeFiles と webFetch も許可してください',
  },
];

/** 申告する権限の規則（BackendInfo.permissionRules） */
export const PERMISSION_RULES: readonly PermissionRule[] = declaredRules(RULES);

/**
 * Codex で守れない権限の組み合わせなら、その理由。Codex は作業にシェルを使うので、コマンドの実行そのものは止められない。
 * read-only（書き込みなし）なら sandbox が書き込みとネットワークを拒否するので、コマンドの効果は読み取りに限られる。
 */
export function unenforceableReason(permissions: Permissions): string | null {
  if (!permissions.readFiles) return 'ファイルの読み取りを止められません（Codex はシェルで読み取ります）';
  if (!permissions.skills) return '利用者全体のスキルを含め、スキルの利用を止められません';
  return brokenRule(RULES, permissions)?.reason ?? null;
}
