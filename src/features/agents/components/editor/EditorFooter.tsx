import { useState } from 'react';
import { Button, ConfirmDialog, Icon, notifyInfo, reportError } from '@/shared/ui';
import type { Agent } from '@/shared/types/domain';
import { tEditor } from '../../i18n/editor';
import { closeAgentEditor, deleteAgent, openAgentWorkspace } from '../../store';
import styles from './EditorFooter.module.css';

export interface EditorFooterProps {
  /** 保存済みのエージェント（新規作成中は null） */
  agent: Agent | null;
  formId: string;
  saving: boolean;
}

function submitLabel(saving: boolean, isNew: boolean): string {
  if (saving) return tEditor('saving');
  return isNew ? tEditor('create') : tEditor('save');
}

/** 足元: 左に補助操作と削除、右に［キャンセル］［作成・保存］ */
export function EditorFooter({ agent, formId, saving }: EditorFooterProps) {
  const [deleting, setDeleting] = useState(false);
  return (
    <>
      {agent && (
        <div className={styles.side}>
          <Button variant="ghost" onClick={() => void openAgentWorkspace(agent.id).catch(reportError)}>
            <Icon name="folder" />
            {tEditor('openWorkspace')}
          </Button>
          <Button variant="danger" onClick={() => setDeleting(true)}>
            <Icon name="trash" />
            {tEditor('delete')}
          </Button>
        </div>
      )}
      <Button onClick={closeAgentEditor}>{agent ? tEditor('close') : tEditor('cancel')}</Button>
      <Button type="submit" form={formId} variant="primary" disabled={saving}>
        {submitLabel(saving, agent === null)}
      </Button>
      {deleting && agent && <DeleteAgentDialog agent={agent} onClose={() => setDeleting(false)} />}
    </>
  );
}

function DeleteAgentDialog({ agent, onClose }: { agent: Agent; onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  const confirm = () => {
    setBusy(true);
    void deleteAgent(agent.id)
      .then(() => notifyInfo(tEditor('deleted', { name: agent.name })), reportError)
      .finally(() => setBusy(false));
  };
  return (
    <ConfirmDialog
      title={tEditor('deleteTitle', { name: agent.name })}
      message={tEditor('deleteMessage')}
      confirmLabel={tEditor('deleteConfirm')}
      danger
      busy={busy}
      onConfirm={confirm}
      onCancel={onClose}
    />
  );
}
