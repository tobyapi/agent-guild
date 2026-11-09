import { Button, Icon, reportError } from '@/shared/ui';
import type { Skill } from '@/shared/types/domain';
import { revealSkillFolder } from '../store';
import details from './SkillDetails.module.css';
import styles from './SkillManager.module.css';

/** リンクしたスキルの本文を見る（読み取り専用。直すのは元のフォルダの SKILL.md） */
export function SkillViewer({ skill, onClose }: { skill: Skill; onClose: () => void }) {
  const path = skill.source?.path ?? null;
  return (
    <section className={styles.editor} aria-label={`${skill.name} の本文`}>
      <div className={details.nameLine}>
        <code className={styles.name}>{skill.name}</code>
        <span className={details.linkMark}>
          <Icon name="link" />
          リンク
        </span>
      </div>
      <p className={details.viewerDescription}>{skill.description}</p>
      {path && (
        <p className={details.viewerNote}>
          元のフォルダ <code>{path}</code> を参照しています。実行のたびに読み直すので、内容を変えるときは元の SKILL.md
          を編集してください。
        </p>
      )}
      {skill.problem && (
        <p className={details.problem}>
          <Icon name="alert" className={details.problemIcon} />
          {skill.problem}
        </p>
      )}
      <pre className={details.viewerBody}>{skill.body.trim() === '' ? '（本文はありません）' : skill.body}</pre>
      <div className={styles.editorActions}>
        {path && (
          <Button onClick={() => void revealSkillFolder(path).catch(reportError)}>
            <Icon name="folder" />
            フォルダを開く
          </Button>
        )}
        <Button onClick={onClose}>閉じる</Button>
      </div>
    </section>
  );
}
