import { Button, Icon, reportError } from '@/shared/ui';
import type { Skill } from '@/shared/types/domain';
import { revealSkillFolder } from '../store';
import { SourceMark } from './SourceMark';
import details from './SkillDetails.module.css';
import styles from './SkillManager.module.css';

/** 参照しているスキル（リンク・内蔵）の本文を見る（読み取り専用。直すのは元の SKILL.md か、コピーしたもの） */
export function SkillViewer({ skill, onClose }: { skill: Skill; onClose: () => void }) {
  const { source } = skill;
  const path = source?.kind === 'linked' ? source.path : null;
  return (
    <section className={styles.editor} aria-label={`${skill.name} の本文`}>
      <div className={details.nameLine}>
        <code className={styles.name}>{skill.name}</code>
        {source && <SourceMark source={source} />}
      </div>
      <p className={details.viewerDescription}>{skill.description}</p>
      {path && (
        <p className={details.viewerNote}>
          元のフォルダ <code>{path}</code> を参照しています。実行のたびに読み直すので、内容を変えるときは元の SKILL.md
          を編集してください。
        </p>
      )}
      {source?.kind === 'builtin' && (
        <p className={details.viewerNote}>
          アプリに入っている内蔵スキルです。アプリを更新すると内容も新しくなります。自分用に直したいときは、いったん外してから「内蔵スキルから追加」の「コピーして追加」で取り込んでください。
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
