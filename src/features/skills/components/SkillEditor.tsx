import { Button, FormAlert, TextAreaField, TextField } from '@/shared/ui';
import type { Skill } from '@/shared/types/domain';
import { useSkillForm } from '../hooks/useSkillForm';
import { t } from '../i18n';
import { skillNameRule } from '../model/validation';
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
    <form
      className={styles.editor}
      onSubmit={form.onSubmit}
      noValidate
      aria-label={skill ? t('editSkill', { name: skill.name }) : t('newSkill')}
    >
      {form.formError && <FormAlert>{form.formError}</FormAlert>}
      <TextField
        label={t('nameLabel')}
        value={draft.name}
        onChange={(value) => form.update('name', value)}
        onBlur={() => form.touch('name')}
        error={errors.name}
        hint={t('nameHint', { rule: skillNameRule() })}
        spellCheck={false}
        autoComplete="off"
        data-autofocus
      />
      <TextAreaField
        label={t('descriptionLabel')}
        value={draft.description}
        onChange={(value) => form.update('description', value)}
        onBlur={() => form.touch('description')}
        error={errors.description}
        hint={t('descriptionHint')}
        rows={2}
      />
      <TextAreaField
        label={t('bodyLabel')}
        optional
        value={draft.body}
        onChange={(value) => form.update('body', value)}
        hint={t('bodyHint')}
        rows={8}
        mono
      />
      <div className={styles.editorActions}>
        <Button onClick={onDone}>{t('cancel')}</Button>
        <Button type="submit" variant="primary" disabled={form.saving}>
          {form.saving ? t('saving') : t('save')}
        </Button>
      </div>
    </form>
  );
}
