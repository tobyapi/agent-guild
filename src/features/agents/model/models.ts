// モデルと推論の深さの選択肢の表示（判定は shared/lib/models.ts）。
import { modelSpecOf } from '@/shared/lib/models';
import type { BackendInfo, ModelSpec } from '@/shared/types/domain';

/** モデルの「既定」の選択肢の名前 */
export function defaultModelLabel(backend: BackendInfo): string {
  if (backend.defaultModel === '') return '既定（バックエンドに任せる）';
  return `既定（${modelSpecOf(backend, '')?.label ?? backend.defaultModel}）`;
}

/** 推論の深さの「既定」の選択肢の名前 */
export function defaultEffortLabel(spec: ModelSpec): string {
  return spec.defaultEffort === null ? '既定（モデルに任せる）' : `既定（${spec.defaultEffort}）`;
}
