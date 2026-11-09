import { useState } from 'react';
import { Button, ConfirmDialog, Icon, notifyInfo, reportError } from '@/shared/ui';
import type { Agent } from '@/shared/types/domain';
import { closeAgentEditor, deleteAgent, openAgentWorkspace } from '../../store';
import styles from './EditorFooter.module.css';

export interface EditorFooterProps {
  /** 保存済みのエージェント（新規作成中は null） */
  agent: Agent | null;
  formId: string;
  saving: boolean;
}

function submitLabel(saving: boolean, isNew: boolean): string {
  if (saving) return '保存中…';
  return isNew ? '作成' : '保存';
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
            作業フォルダを開く
          </Button>
          <Button variant="danger" onClick={() => setDeleting(true)}>
            <Icon name="trash" />
            削除
          </Button>
        </div>
      )}
      <Button onClick={closeAgentEditor}>{agent ? '閉じる' : 'キャンセル'}</Button>
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
      .then(() => notifyInfo(`${agent.name} を削除しました`), reportError)
      .finally(() => setBusy(false));
  };
  return (
    <ConfirmDialog
      title={`${agent.name} を削除しますか？`}
      message="これまでの発言は残ります。スキルと作業フォルダは消え、元に戻せません。"
      confirmLabel="削除する"
      danger
      busy={busy}
      onConfirm={confirm}
      onCancel={onClose}
    />
  );
}
