import { SelectField, TextField } from '@/shared/ui';
import type { BackendInfo, ModelSpec } from '@/shared/types/domain';
import { modelSpecOf } from '@/shared/lib/models';
import { defaultEffortLabel, defaultModelLabel } from '../../model/models';

export interface ModelFieldsProps {
  backend: BackendInfo | undefined;
  model: string;
  effort: string;
  effortError?: string;
  onModel: (model: string) => void;
  onEffort: (effort: string) => void;
}

/**
 * モデルと推論の深さ。バックエンドがモデルの一覧を申告していれば選択式で、推論の深さは選んだモデルが選べるものだけ。
 * 一覧が分からなければモデルは自由入力（推論の深さは選べない）
 */
export function ModelFields({ backend, model, effort, effortError, onModel, onEffort }: ModelFieldsProps) {
  if (!backend || backend.models.length === 0) {
    return (
      <TextField
        label="モデル"
        optional
        value={model}
        onChange={onModel}
        placeholder={backend?.defaultModel ? `既定: ${backend.defaultModel}` : '既定のモデル'}
        hint="空欄ならバックエンドの既定のモデルを使います。"
        spellCheck={false}
      />
    );
  }
  const spec = modelSpecOf(backend, model);
  const listed = model === '' || spec !== undefined;
  return (
    <>
      <SelectField
        label="モデル"
        value={model}
        onChange={onModel}
        hint={spec && spec.description !== '' ? spec.description : undefined}
      >
        <option value="">{defaultModelLabel(backend)}</option>
        {backend.models.map((candidate) => (
          <option key={candidate.id} value={candidate.id}>
            {candidate.label}
          </option>
        ))}
        {!listed && <option value={model}>{model}（一覧にありません）</option>}
      </SelectField>
      {spec && (spec.efforts.length > 0 || effort !== '') && (
        <EffortField spec={spec} effort={effort} error={effortError} onChange={onEffort} />
      )}
    </>
  );
}

interface EffortFieldProps {
  spec: ModelSpec;
  effort: string;
  error?: string;
  onChange: (effort: string) => void;
}

function EffortField({ spec, effort, error, onChange }: EffortFieldProps) {
  const listed = effort === '' || spec.efforts.includes(effort);
  return (
    <SelectField
      label="推論の深さ"
      value={effort}
      onChange={onChange}
      error={error}
      hint="深いほど、よく考えてから答えます（時間と使用量が増えます）。"
    >
      <option value="">{defaultEffortLabel(spec)}</option>
      {spec.efforts.map((choice) => (
        <option key={choice} value={choice}>
          {choice}
        </option>
      ))}
      {!listed && <option value={effort}>{effort}（このモデルでは選べません）</option>}
    </SelectField>
  );
}
