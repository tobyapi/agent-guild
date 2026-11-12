import { useId, useState } from 'react';
import { Button, ConfirmDialog, Dialog, FormAlert, Icon, notifyInfo, reportError, TextField } from '@/shared/ui';
import type { Channel } from '@/shared/types/domain';
import { useChannel, useChannelDialog } from '../hooks/useChannels';
import { useChannelForm } from '../hooks/useChannelForm';
import { closeChannelDialog, deleteChannel } from '../store';
import { ChannelWorkspaceFields } from './ChannelWorkspaceFields';
import { MemberPicker } from './MemberPicker';
import { t } from '../i18n';
import styles from './ChannelDialog.module.css';

/** チャンネルの作成・編集ダイアログ。対象は channels のストアで決まる */
export function ChannelDialog() {
  const target = useChannelDialog();
  const channel = useChannel(target?.mode === 'edit' ? target.channelId : null);
  if (!target) return null;
  return <ChannelForm key={channel?.id ?? 'new'} channel={channel} />;
}

function ChannelForm({ channel }: { channel: Channel | null }) {
  const form = useChannelForm(channel);
  const formId = useId();
  const [deleting, setDeleting] = useState(false);
  const footer = (
    <>
      {channel && (
        <Button variant="danger" className={styles.delete} onClick={() => setDeleting(true)}>
          <Icon name="trash" />
          {t('delete')}
        </Button>
      )}
      <Button onClick={closeChannelDialog}>{t('cancel')}</Button>
      <Button type="submit" form={formId} variant="primary" disabled={form.saving}>
        {t(form.saving ? 'saving' : channel ? 'save' : 'create')}
      </Button>
    </>
  );
  return (
    <Dialog
      size="sm"
      title={channel ? t('editTitle', { name: channel.name }) : t('createChannel')}
      onClose={closeChannelDialog}
      footer={footer}
    >
      <form id={formId} className={styles.form} onSubmit={form.onSubmit} noValidate>
        {form.formError && <FormAlert>{form.formError}</FormAlert>}
        <TextField
          label={t('nameLabel')}
          value={form.draft.name}
          onChange={(value) => form.update('name', value)}
          onBlur={() => form.touch('name')}
          error={form.errors.name}
          placeholder={t('namePlaceholder')}
          autoComplete="off"
          data-autofocus
        />
        <TextField
          label={t('topicLabel')}
          optional
          value={form.draft.topic}
          onChange={(value) => form.update('topic', value)}
          onBlur={() => form.touch('topic')}
          error={form.errors.topic}
          hint={t('topicHint')}
        />
        <ChannelWorkspaceFields form={form} />
        {!channel && <MemberPicker selected={form.draft.memberIds} onChange={(ids) => form.update('memberIds', ids)} />}
      </form>
      {deleting && channel && <DeleteChannelDialog channel={channel} onClose={() => setDeleting(false)} />}
    </Dialog>
  );
}

function DeleteChannelDialog({ channel, onClose }: { channel: Channel; onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  const confirm = () => {
    setBusy(true);
    void deleteChannel(channel.id)
      .then(() => notifyInfo(t('deleted', { name: channel.name })), reportError)
      .finally(() => setBusy(false));
  };
  return (
    <ConfirmDialog
      title={t('deleteTitle', { name: channel.name })}
      message={t('deleteMessage')}
      confirmLabel={t('deleteConfirm')}
      danger
      busy={busy}
      onConfirm={confirm}
      onCancel={onClose}
    />
  );
}
