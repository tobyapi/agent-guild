import { useState } from 'react';
import type { FormEvent } from 'react';
import { errorCode, errorField, errorMessage } from '@/shared/lib/errors';
import { hasErrors, notifyInfo, reportError, useFieldErrors } from '@/shared/ui';
import type { Channel } from '@/shared/types/domain';
import { channelErrorField, cleanChannelName, validateChannelDraft } from '../model/channels';
import type { ChannelDraft, ChannelField } from '../model/channels';
import { closeChannelDialog, createChannel, updateChannel } from '../store';

async function persist(channel: Channel | null, draft: ChannelDraft): Promise<void> {
  const name = cleanChannelName(draft.name);
  const topic = draft.topic.trim();
  if (channel) {
    await updateChannel(channel.id, name, topic);
    notifyInfo('保存しました');
  } else {
    const created = await createChannel(name, topic, draft.memberIds);
    notifyInfo(`#${created.name} を作成しました`);
  }
  closeChannelDialog();
}

/** チャンネルの作成・編集（channel が null なら作成） */
export function useChannelForm(channel: Channel | null) {
  const [draft, setDraft] = useState<ChannelDraft>(() => ({
    name: channel?.name ?? '',
    topic: channel?.topic ?? '',
    memberIds: [],
  }));
  const [serverError, setServerError] = useState<{ field: ChannelField | null; message: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const errors = validateChannelDraft(draft);
  const { visible, touch, markSubmitted } = useFieldErrors<ChannelField>(errors);

  const update = <K extends keyof ChannelDraft>(key: K, value: ChannelDraft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setServerError(null);
  };

  const save = async () => {
    markSubmitted();
    if (hasErrors(errors)) return;
    setSaving(true);
    try {
      await persist(channel, draft);
    } catch (error) {
      if (errorCode(error) === 'validation')
        setServerError({ field: channelErrorField(errorField(error)), message: errorMessage(error) });
      else reportError(error);
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
