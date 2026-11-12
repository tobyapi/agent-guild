import { useState } from 'react';
import type { FormEvent } from 'react';
import { errorCode, errorField, errorMessage } from '@/shared/lib/errors';
import { hasErrors, notifyInfo, reportError, useFieldErrors } from '@/shared/ui';
import type { Skill } from '@/shared/types/domain';
import { t } from '../i18n';
import { skillErrorField, validateSkillDraft } from '../model/validation';
import type { SkillDraft, SkillField } from '../model/validation';
import { saveSkill } from '../store';

interface Options {
  agentId: string;
  /** 編集するスキル（新規なら null） */
  skill: Skill | null;
  /** 同じエージェントのスキル（名前の重複を確かめる） */
  existing: readonly Skill[];
  onDone: () => void;
}

interface ServerError {
  field: SkillField | null;
  message: string;
}

export function useSkillForm({ agentId, skill, existing, onDone }: Options) {
  const [draft, setDraft] = useState<SkillDraft>(() => ({
    name: skill?.name ?? '',
    description: skill?.description ?? '',
    body: skill?.body ?? '',
  }));
  const [serverError, setServerError] = useState<ServerError | null>(null);
  const [saving, setSaving] = useState(false);
  const errors = validateSkillDraft(draft, existing, skill?.id ?? null);
  const { visible, touch, markSubmitted } = useFieldErrors<SkillField>(errors);

  const update = (key: SkillField, value: string) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setServerError(null);
  };

  const save = async () => {
    markSubmitted();
    if (hasErrors(errors)) return;
    setSaving(true);
    try {
      const input = { id: skill?.id ?? null, agentId, ...draft, description: draft.description.trim() };
      await saveSkill(input);
      notifyInfo(t('saved'));
      onDone();
    } catch (error) {
      const code = errorCode(error);
      if (code === 'validation' || code === 'conflict') {
        setServerError({ field: skillErrorField(code, errorField(error)), message: errorMessage(error) });
      } else {
        reportError(error);
      }
    } finally {
      setSaving(false);
    }
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    void save();
  };

  const fieldErrors = serverError?.field ? { ...visible, [serverError.field]: serverError.message } : visible;
  const formError = serverError && serverError.field === null ? serverError.message : null;
  return { draft, errors: fieldErrors, formError, saving, update, touch, onSubmit };
}
