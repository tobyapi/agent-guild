import { cx } from '@/shared/lib/cx';
import { Icon, IconButton, reportError } from '@/shared/ui';
import type { Skill } from '@/shared/types/domain';
import { revealSkillFolder } from '../store';
import { SourceMark } from './SourceMark';
import details from './SkillDetails.module.css';
import styles from './SkillManager.module.css';

export interface SkillRowProps {
  skill: Skill;
  onEdit: () => void;
  onView: () => void;
  onDelete: () => void;
}

/**
 * スキルの行。参照しているスキル（リンク・内蔵）は印を出し、編集の代わりに「本文を見る」。
 * リンクしたスキルは元のフォルダと「フォルダを開く」も出す
 */
export function SkillRow({ skill, onEdit, onView, onDelete }: SkillRowProps) {
  const { source, problem } = skill;
  const linkedPath = source?.kind === 'linked' ? source.path : null;
  return (
    <li className={cx(styles.row, problem && details.problemRow)}>
      <div className={styles.rowText}>
        <span className={details.nameLine}>
          <code className={styles.name}>{skill.name}</code>
          {source && <SourceMark source={source} />}
        </span>
        <span className={styles.description}>{skill.description}</span>
        {linkedPath && (
          <span className={details.source} title={linkedPath}>
            {linkedPath}
          </span>
        )}
        {problem && (
          <span className={details.problem}>
            <Icon name="alert" className={details.problemIcon} />
            {problem}
          </span>
        )}
      </div>
      {source ? (
        <>
          <IconButton label={`${skill.name} の本文を見る`} onClick={onView}>
            <Icon name="eye" />
          </IconButton>
          {linkedPath && (
            <IconButton
              label={`${skill.name} のフォルダを開く`}
              onClick={() => void revealSkillFolder(linkedPath).catch(reportError)}
            >
              <Icon name="folder" />
            </IconButton>
          )}
          <IconButton label={`${skill.name} を外す`} onClick={onDelete}>
            <Icon name="close" />
          </IconButton>
        </>
      ) : (
        <>
          <IconButton label={`${skill.name} を編集`} onClick={onEdit}>
            <Icon name="edit" />
          </IconButton>
          <IconButton label={`${skill.name} を削除`} onClick={onDelete}>
            <Icon name="trash" />
          </IconButton>
        </>
      )}
    </li>
  );
}
