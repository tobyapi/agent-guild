import { useState } from 'react';
import type { FormEvent } from 'react';
import { errorCode, errorField, errorMessage } from '@/shared/lib/errors';
import { hasErrors, notifyInfo, reportError, useFieldErrors } from '@/shared/ui';
import type { Profile } from '@/shared/types/domain';
import { validateProfile } from '../model/validation';
import type { ProfileField } from '../model/validation';
import { saveProfile } from '../store';
import { useProfile } from './useProfile';

/** プロフィールの編集。takenNames は重複してはいけない名前（削除されていないエージェントの名前） */
export function useProfileForm(takenNames: readonly string[]) {
  const me = useProfile();
  const [draft, setDraft] = useState<Profile>(me);
  const [serverError, setServerError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const errors = validateProfile(draft, takenNames);
  const { visible, touch, markSubmitted } = useFieldErrors<ProfileField>(errors);

  const update = <K extends ProfileField>(key: K, value: Profile[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
    if (key === 'name') setServerError(null);
  };

  const save = async () => {
    markSubmitted();
    if (hasErrors(errors)) return;
    setSaving(true);
    try {
      await saveProfile({ ...draft, name: draft.name.trim() });
      notifyInfo('保存しました');
    } catch (error) {
      // 名前の問題（重複など）は名前の欄に、それ以外はトーストで知らせる
      if (errorCode(error) === 'validation' && errorField(error) === 'name') setServerError(errorMessage(error));
      else reportError(error);
    } finally {
      setSaving(false);
    }
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    void save();
  };

  return { draft, errors: { ...visible, name: serverError ?? visible.name }, saving, update, touch, onSubmit };
}
