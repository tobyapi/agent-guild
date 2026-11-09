import { useId } from 'react';
import { BackendStatus, useBackends } from '@/features/runtime';
import { SelectField, TextField } from '@/shared/ui';
import type { BackendInfo } from '@/shared/types/domain';
import type { AgentDraft, DraftUpdate } from '../../model/draft';
import type { AgentErrors } from '../../model/validation';
import { BackendOptionsFields } from './BackendOptionsFields';
import { EditorSection } from './EditorSection';

export interface BrainFieldsProps {
  draft: AgentDraft;
  errors: AgentErrors;
  optionErrors: Record<string, string>;
  update: DraftUpdate;
  onBackend: (backendId: string) => void;
}

function modelPlaceholder(backend: BackendInfo | undefined): string {
  return backend?.defaultModel ? `既定: ${backend.defaultModel}` : '既定のモデル';
}

/** 頭脳: バックエンド（状態と再確認）・モデル・バックエンド固有の詳細設定 */
export function BrainFields({ draft, errors, optionErrors, update, onBackend }: BrainFieldsProps) {
  const backends = useBackends();
  const listId = useId();
  const backend = backends.find((candidate) => candidate.id === draft.backend);
  const unknownBackend = backend === undefined && draft.backend !== '';
  return (
    <EditorSection title="頭脳">
      <SelectField
        label="バックエンド"
        value={draft.backend}
        onChange={onBackend}
        error={errors.backend}
        hint={backends.length === 0 ? 'エージェントの実行環境が起動すると選べます。' : undefined}
      >
        {draft.backend === '' && <option value="">選んでください</option>}
        {unknownBackend && <option value={draft.backend}>{draft.backend}（この環境にはありません）</option>}
        {backends.map((candidate) => (
          <option key={candidate.id} value={candidate.id}>
            {candidate.id} — {candidate.label}
          </option>
        ))}
      </SelectField>
      {backend && <BackendStatus backend={backend} />}
      <TextField
        label="モデル"
        optional
        value={draft.model}
        onChange={(value) => update('model', value)}
        list={listId}
        placeholder={modelPlaceholder(backend)}
        hint="空欄ならバックエンドの既定のモデルを使います。"
        spellCheck={false}
      />
      <datalist id={listId}>
        {backend?.modelSuggestions.map((model) => <option key={model} value={model} />)}
      </datalist>
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
