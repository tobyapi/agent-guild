import { useState } from 'react';
import type { FormEvent } from 'react';
import { errorCode, errorField, errorMessage } from '@/shared/lib/errors';
import { cleanGuild } from '@/shared/lib/guild';
import { hasErrors, notifyInfo, reportError, useFieldErrors } from '@/shared/ui';
import type { GuildCrest, GuildProfile } from '@/shared/types/domain';
import { t } from '../i18n';
import { validateGuild } from '../model/validation';
import { saveGuild } from '../store';
import { useGuild } from './useGuild';

/** ギルドの名前と紋の編集（保存するまで画面のほかの場所は変わらない） */
export function useGuildForm() {
  const guild = useGuild();
  const [draft, setDraft] = useState<GuildProfile>(guild);
  const [serverError, setServerError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const errors = validateGuild(draft);
  const { visible, touch, markSubmitted } = useFieldErrors<'name'>(errors);

  const setName = (name: string) => {
    setDraft((current) => ({ ...current, name }));
    setServerError(null);
  };
  const setCrest = (crest: Partial<GuildCrest>) => {
    setDraft((current) => ({ ...current, crest: { ...current.crest, ...crest } }));
  };

  const save = async () => {
    markSubmitted();
    if (hasErrors(errors)) return;
    setSaving(true);
    try {
      setDraft(await saveGuild(cleanGuild(draft)));
      notifyInfo(t('saved'));
    } catch (error) {
      // 名前の問題は名前の欄に、それ以外はトーストで知らせる
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

  return {
    draft,
    errors: { ...visible, name: serverError ?? visible.name },
    saving,
    setName,
    setCrest,
    touchName: () => touch('name'),
    onSubmit,
  };
}
