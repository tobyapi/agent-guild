import { Button, FormAlert, TextAreaField, TextField } from '@/shared/ui';
import type { Skill } from '@/shared/types/domain';
import { useSkillForm } from '../hooks/useSkillForm';
import { SKILL_NAME_RULE } from '../model/validation';
import styles from './SkillManager.module.css';

export interface SkillEditorProps {
  agentId: string;
  skill: Skill | null;
  existing: readonly Skill[];
  onDone: () => void;
}

/** スキルの作成・編集（名前・説明・本文 = SKILL.md） */
export function SkillEditor({ agentId, skill, existing, onDone }: SkillEditorProps) {
  const form = useSkillForm({ agentId, skill, existing, onDone });
  const { draft, errors } = form;
  return (
    <form className={styles.editor} onSubmit={form.onSubmit} noValidate aria-label={skill ? `${skill.name} を編集` : '新しいスキル'}>
      {form.formError && <FormAlert>{form.formError}</FormAlert>}
      <TextField
        label="名前"
        value={draft.name}
        onChange={(value) => form.update('name', value)}
        onBlur={() => form.touch('name')}
        error={errors.name}
        hint={`${SKILL_NAME_RULE}。例: code-review`}
        spellCheck={false}
        autoComplete="off"
        data-autofocus
      />
      <TextAreaField
        label="説明"
        value={draft.description}
        onChange={(value) => form.update('description', value)}
        onBlur={() => form.touch('description')}
        error={errors.description}
        hint="いつ使うスキルかを書きます。エージェントはこれを見て、読むかどうかを決めます。"
        rows={2}
      />
      <TextAreaField
        label="本文（SKILL.md）"
        optional
        value={draft.body}
        onChange={(value) => form.update('body', value)}
        hint="Markdown で手順や観点を書きます。"
        rows={8}
        mono
      />
      <div className={styles.editorActions}>
        <Button onClick={onDone}>キャンセル</Button>
        <Button type="submit" variant="primary" disabled={form.saving}>
          {form.saving ? '保存中…' : '保存'}
        </Button>
      </div>
    </form>
  );
}
