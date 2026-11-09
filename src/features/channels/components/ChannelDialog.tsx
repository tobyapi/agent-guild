import { useId, useState } from 'react';
import { Button, ConfirmDialog, Dialog, FormAlert, Icon, notifyInfo, reportError, TextField } from '@/shared/ui';
import type { Channel } from '@/shared/types/domain';
import { useChannel, useChannelDialog } from '../hooks/useChannels';
import { useChannelForm } from '../hooks/useChannelForm';
import { closeChannelDialog, deleteChannel } from '../store';
import { MemberPicker } from './MemberPicker';
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
          削除
        </Button>
      )}
      <Button onClick={closeChannelDialog}>キャンセル</Button>
      <Button type="submit" form={formId} variant="primary" disabled={form.saving}>
        {form.saving ? '保存中…' : channel ? '保存' : '作成'}
      </Button>
    </>
  );
  return (
    <Dialog
      size="sm"
      title={channel ? `#${channel.name} を編集` : 'チャンネルを作成'}
      onClose={closeChannelDialog}
      footer={footer}
    >
      <form id={formId} className={styles.form} onSubmit={form.onSubmit} noValidate>
        {form.formError && <FormAlert>{form.formError}</FormAlert>}
        <TextField
          label="名前"
          value={form.draft.name}
          onChange={(value) => form.update('name', value)}
          onBlur={() => form.touch('name')}
          error={form.errors.name}
          placeholder="例: 勉強会の企画"
          autoComplete="off"
          data-autofocus
        />
        <TextField
          label="話題"
          optional
          value={form.draft.topic}
          onChange={(value) => form.update('topic', value)}
          onBlur={() => form.touch('topic')}
          error={form.errors.topic}
          hint="エージェントは話題を見て、何のための場所かを知ります。"
        />
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
      .then(() => notifyInfo(`#${channel.name} を削除しました`), reportError)
      .finally(() => setBusy(false));
  };
  return (
    <ConfirmDialog
      title={`#${channel.name} を削除しますか？`}
      message="このチャンネルの発言はすべて消え、元に戻せません。"
      confirmLabel="削除する"
      danger
      busy={busy}
      onConfirm={confirm}
      onCancel={onClose}
    />
  );
}
