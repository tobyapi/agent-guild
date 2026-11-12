// 画像を描く実行（image 要求）の Codex の設定。添えたスキルの手順（画像の生成 → 見て確かめる → 透明や大きさを直して保存
// → 描き直す）をそのまま行えるよう、組み込みの画像の生成（image_gen）に加えて、シェルと画像を見る道具を使わせる。
// sandbox は workspace-write で、書き込みは作業場所（cwd）の中だけ（一時フォルダも除く。追加の書き込み先はない）。
// 読み取りは絞らない（Windows の標準の隔離では絞れない。./options.ts と同じ）。ネットワーク・Web 検索・アプリ・
// プラグイン・ブラウザ・コンピューターの操作・サブエージェントは切り、承認は求めない（never）。

import type { CodexOptions, ThreadOptions } from '@openai/codex-sdk';
import { SECRET_ENV_GLOBS } from '../agent-env.ts';
import type { ModelCatalog } from '../types.ts';
import { CODEX_EFFORTS, defaultEffortOf } from './models.ts';

/**
 * 画像の実行で切り替える Codex の機能（`codex features list` の名前。0.163〜0.167 で確かめた）。
 * image_generation は既定でオンだが、利用者の config.toml で切っていても使えるよう明示する
 */
export const IMAGE_FEATURES = {
  image_generation: true,
  shell_tool: true,
  view_image: true,
  apps: false,
  plugins: false,
  multi_agent: false,
  browser_use: false,
  computer_use: false,
  in_app_browser: false,
} as const;

/** 画像を描くときの推論の深さ（利用者が選んだもの。モデルで選べなければモデルの既定） */
const IMAGE_EFFORT = 'low';

/** systemPrompt が空なら developer_instructions を足さない（スキルの手順を狭める決まりを置かない） */
export function imageConfig(systemPrompt: string): NonNullable<CodexOptions['config']> {
  return {
    ...(systemPrompt === '' ? {} : { developer_instructions: systemPrompt }),
    project_doc_max_bytes: 0,
    features: { ...IMAGE_FEATURES },
    // 書き込みは作業場所だけ（既定では TMPDIR と /tmp にも書ける）
    sandbox_workspace_write: { exclude_tmpdir_env_var: true, exclude_slash_tmp: true },
    shell_environment_policy: { exclude: [...SECRET_ENV_GLOBS] },
  };
}

/** モデルは一覧の既定（なければ Codex に任せる）。深さは、そのモデルで選べれば low、選べなければモデルの既定 */
export function imageThreadOptions(workspace: string, catalog: ModelCatalog): ThreadOptions {
  const model = catalog.defaultModel;
  const efforts = catalog.models.find((spec) => spec.id === model)?.efforts ?? [];
  const wanted = efforts.includes(IMAGE_EFFORT) ? IMAGE_EFFORT : defaultEffortOf(catalog, model);
  return {
    workingDirectory: workspace,
    skipGitRepoCheck: true,
    sandboxMode: 'workspace-write',
    approvalPolicy: 'never',
    webSearchMode: 'disabled',
    networkAccessEnabled: false,
    model: model || undefined,
    modelReasoningEffort: CODEX_EFFORTS.find((effort) => effort === wanted),
  };
}
