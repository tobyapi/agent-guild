import { TextAreaField, TextField } from '@/shared/ui';
import type { AgentDraft, DraftUpdate } from '../../model/draft';
import { tEditor } from '../../i18n/editor';
import { personalities } from '../../model/personas/personalities';
import { tones } from '../../model/personas/tones';
import { EditorSection } from './EditorSection';
import { PersonaPresetField } from './PersonaPresetField';

export interface PersonaFieldsProps {
  draft: AgentDraft;
  update: DraftUpdate;
}

/** 人格: 担当・得意分野・性格・口調（docs/ui-design.md §5.11 の順）。性格と口調はプリセットから選べる */
export function PersonaFields({ draft, update }: PersonaFieldsProps) {
  return (
    <EditorSection title={tEditor('personaSection')}>
      <TextField
        label={tEditor('roleLabel')}
        optional
        value={draft.role}
        onChange={(value) => update('role', value)}
        placeholder={tEditor('rolePlaceholder')}
      />
      <TextAreaField
        label={tEditor('expertiseLabel')}
        optional
        value={draft.expertise}
        onChange={(value) => update('expertise', value)}
        hint={tEditor('expertiseHint')}
        placeholder={tEditor('expertisePlaceholder')}
        rows={2}
      />
      <PersonaPresetField
        label={tEditor('personalityLabel')}
        value={draft.personality}
        onChange={(value) => update('personality', value)}
        presets={personalities()}
        placeholder={tEditor('personalityPlaceholder')}
        multiline
      />
      <PersonaPresetField
        label={tEditor('toneLabel')}
        value={draft.tone}
        onChange={(value) => update('tone', value)}
        presets={tones()}
        placeholder={tEditor('tonePlaceholder')}
      />
    </EditorSection>
  );
}
