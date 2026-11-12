// モデルと推論の深さの選択肢の表示（判定は shared/lib/models.ts）。
import { modelSpecOf } from '@/shared/lib/models';
import { tBrain } from '../i18n/brain';
import type { BackendInfo, ModelSpec } from '@/shared/types/domain';

/** モデルの「既定」の選択肢の名前 */
export function defaultModelLabel(backend: BackendInfo): string {
  if (backend.defaultModel === '') return tBrain('defaultModelAuto');
  return tBrain('defaultNamed', { value: modelSpecOf(backend, '')?.label ?? backend.defaultModel });
}

/** 推論の深さの「既定」の選択肢の名前 */
export function defaultEffortLabel(spec: ModelSpec): string {
  return spec.defaultEffort === null
    ? tBrain('defaultEffortAuto')
    : tBrain('defaultNamed', { value: spec.defaultEffort });
}
