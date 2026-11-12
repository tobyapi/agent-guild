import { BackendStatus, useBackends } from '@/features/runtime';
import { SelectField } from '@/shared/ui';
import { tBrain } from '../../i18n/brain';
import type { AgentDraft, DraftUpdate } from '../../model/draft';
import type { AgentErrors } from '../../model/validation';
import { BackendOptionsFields } from './BackendOptionsFields';
import { EditorSection } from './EditorSection';
import { ModelFields } from './ModelFields';

export interface BrainFieldsProps {
  draft: AgentDraft;
  errors: AgentErrors;
  optionErrors: Record<string, string>;
  update: DraftUpdate;
  onBackend: (backendId: string) => void;
  onModel: (model: string) => void;
}

/** 頭脳: バックエンド（状態と再確認）・モデルと推論の深さ・バックエンド固有の詳細設定 */
export function BrainFields({ draft, errors, optionErrors, update, onBackend, onModel }: BrainFieldsProps) {
  const backends = useBackends();
  const backend = backends.find((candidate) => candidate.id === draft.backend);
  const unknownBackend = backend === undefined && draft.backend !== '';
  return (
    <EditorSection title={tBrain('brainSection')}>
      <SelectField
        label={tBrain('backendLabel')}
        value={draft.backend}
        onChange={onBackend}
        error={errors.backend}
        hint={backends.length === 0 ? tBrain('backendWaiting') : undefined}
      >
        {draft.backend === '' && <option value="">{tBrain('chooseOption')}</option>}
        {unknownBackend && <option value={draft.backend}>{tBrain('unknownBackend', { id: draft.backend })}</option>}
        {backends.map((candidate) => (
          <option key={candidate.id} value={candidate.id}>
            {candidate.id} — {candidate.label}
          </option>
        ))}
      </SelectField>
      {backend && <BackendStatus backend={backend} />}
      <ModelFields
        backend={backend}
        model={draft.model}
        effort={draft.effort}
        effortError={errors.effort}
        onModel={onModel}
        onEffort={(effort) => update('effort', effort)}
      />
      {backend && backend.options.length > 0 && (
        <BackendOptionsFields
          backend={backend}
          values={draft.optionValues}
          errors={optionErrors}
          onChange={(values) => update('optionValues', values)}
        />
      )}
    </EditorSection>
  );
}
