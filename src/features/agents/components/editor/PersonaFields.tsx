import { TextAreaField, TextField } from '@/shared/ui';
import type { AgentDraft, DraftUpdate } from '../../model/draft';
import { PERSONALITIES } from '../../model/personas/personalities';
import { TONES } from '../../model/personas/tones';
import { EditorSection } from './EditorSection';
import { PersonaPresetField } from './PersonaPresetField';

export interface PersonaFieldsProps {
  draft: AgentDraft;
  update: DraftUpdate;
}

/** 人格: 担当・得意分野・性格・口調（docs/ui-design.md §5.11 の順）。性格と口調はプリセットから選べる */
export function PersonaFields({ draft, update }: PersonaFieldsProps) {
  return (
    <EditorSection title="人格">
      <TextField
        label="担当"
        optional
        value={draft.role}
        onChange={(value) => update('role', value)}
        placeholder="例: リサーチと企画の担当"
      />
      <TextAreaField
        label="得意分野"
        optional
        value={draft.expertise}
        onChange={(value) => update('expertise', value)}
        hint="相談相手の一覧に出ます。ほかのエージェントは相談先を選ぶときにこれを見ます。"
        placeholder="例: ソフトウェア設計とコードレビュー"
        rows={2}
      />
      <PersonaPresetField
        label="性格"
        value={draft.personality}
        onChange={(value) => update('personality', value)}
        presets={PERSONALITIES}
        placeholder="例: 好奇心旺盛。気になったことはすぐ調べる。"
        multiline
      />
      <PersonaPresetField
        label="口調"
        value={draft.tone}
        onChange={(value) => update('tone', value)}
        presets={TONES}
        placeholder="例: フランクな丁寧語"
      />
    </EditorSection>
  );
}
