import { useState } from 'react';
import { ConfirmDialog, notifyInfo, reportError } from '@/shared/ui';
import type { Skill } from '@/shared/types/domain';
import { t } from '../i18n';
import { deleteSkill } from '../store';

/** スキルの削除の確認。参照しているスキル（リンク・内蔵）は「外す」だけで、元のフォルダや内蔵スキルは消えない */
export function DeleteSkillDialog({ skill, onClose }: { skill: Skill; onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  const linked = skill.source !== null;
  const confirm = () => {
    setBusy(true);
    void deleteSkill(skill)
      .then(() => {
        notifyInfo(linked ? t('detached') : t('deleted'));
        onClose();
      }, reportError)
      .finally(() => setBusy(false));
  };
  return (
    <ConfirmDialog
      title={t(linked ? 'detachTitle' : 'deleteTitle', { name: skill.name })}
      message={
        skill.source?.kind === 'builtin'
          ? t('detachBuiltinMessage')
          : linked
            ? t('detachLinkedMessage')
            : t('deleteMessage')
      }
      confirmLabel={linked ? t('detachConfirm') : t('deleteConfirm')}
      danger={!linked}
      busy={busy}
      onConfirm={confirm}
      onCancel={onClose}
    />
  );
}
