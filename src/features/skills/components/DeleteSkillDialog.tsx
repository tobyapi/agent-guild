import { useState } from 'react';
import { ConfirmDialog, notifyInfo, reportError } from '@/shared/ui';
import type { Skill } from '@/shared/types/domain';
import { deleteSkill } from '../store';

/** スキルの削除の確認。参照しているスキル（リンク・内蔵）は「外す」だけで、元のフォルダや内蔵スキルは消えない */
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
        skill.source?.kind === 'builtin'
          ? 'このエージェントから内蔵スキルを外します。あとで「内蔵スキルから追加」からまた付けられます。'
          : linked
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
