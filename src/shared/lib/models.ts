// モデルと推論の深さ（BackendInfo.models と、backendOptions の EFFORT_OPTION）の判定（docs/design.md §2・§5）。
// Rust の保存時検証（guild-domain の backend/options.rs）と同じ判定を、編集画面とモックで使う。
// モデルが空なら既定のモデル（defaultModel）で考える。推論の深さは空 = 選ばない = 既定（キーを保存しない）。
import { EFFORT_OPTION } from '@/shared/types/domain';
import type { BackendInfo, ModelSpec } from '@/shared/types/domain';

/** 実際に使うモデル（空なら既定のモデル）の定義。バックエンドかモデルが一覧に無ければ undefined */
export function modelSpecOf(backend: BackendInfo | undefined, model: string): ModelSpec | undefined {
  if (!backend) return undefined;
  const id = model === '' ? backend.defaultModel : model;
  return backend.models.find((spec) => spec.id === id);
}

/** 推論の深さがモデルで選べなければ、その知らせ。モデルが一覧に無ければ確かめない（使えない値はランナーが無視する） */
export function checkEffort(backend: BackendInfo | undefined, model: string, effort: string): string | null {
  const spec = modelSpecOf(backend, model);
  if (effort === '' || !spec || spec.efforts.includes(effort)) return null;
  if (spec.efforts.length === 0) return `「${spec.label}」では推論の深さを選べません`;
  return `「${spec.label}」では推論の深さ「${effort}」を選べません`;
}

/** backendOptions の推論の深さ（なければ空 = 既定） */
export function effortFrom(options: Readonly<Record<string, unknown>>): string {
  const effort = options[EFFORT_OPTION];
  return typeof effort === 'string' ? effort : '';
}

/** backendOptions に推論の深さを入れる（空なら取り除く） */
export function withEffort(options: Readonly<Record<string, unknown>>, effort: string): Record<string, unknown> {
  const rest = Object.fromEntries(Object.entries(options).filter(([key]) => key !== EFFORT_OPTION));
  return effort === '' ? rest : { ...rest, [EFFORT_OPTION]: effort };
}
