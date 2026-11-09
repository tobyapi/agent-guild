import { useState } from 'react';
import { ConfirmDialog, notifyInfo, reportError } from '@/shared/ui';
import type { Skill } from '@/shared/types/domain';
import { deleteSkill } from '../store';

/** スキルの削除の確認。リンクしたスキルは「外す」だけで、元のフォルダは消えない */
export function DeleteSkillDialog({ skill, onClose }: { skill: Skill; onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  const linked = skill.source !== null;
  const confirm = () => {
    setBusy(true);
    void deleteSkill(skill)
      .then(() => {
        notifyInfo(linked ? 'スキルを外しました' : 'スキルを削除しました');
        onClose();
      }, reportError)
      .finally(() => setBusy(false));
  };
  return (
    <ConfirmDialog
      title={linked ? `${skill.name} を外しますか？` : `${skill.name} を削除しますか？`}
      message={
        linked
          ? 'このエージェントからリンクを外します。元のフォルダと SKILL.md は消えません。'
          : 'スキルの内容は消え、元に戻せません。'
      }
      confirmLabel={linked ? '外す' : '削除する'}
      danger={!linked}
      busy={busy}
      onConfirm={confirm}
      onCancel={onClose}
    />
  );
}
