import { Button, Icon, reportError } from '@/shared/ui';
import type { Skill } from '@/shared/types/domain';
import { t } from '../i18n';
import { revealSkillFolder } from '../store';
import { SourceMark } from './SourceMark';
import details from './SkillDetails.module.css';
import styles from './SkillManager.module.css';

/** 参照しているスキル（リンク・内蔵）の本文を見る（読み取り専用。直すのは元の SKILL.md か、コピーしたもの） */
export function SkillViewer({ skill, onClose }: { skill: Skill; onClose: () => void }) {
  const { source } = skill;
  const path = source?.kind === 'linked' ? source.path : null;
  // 文言の中のフォルダの位置に <code> を置く
  const [beforePath, afterPath] = t('viewerLinked').split('{path}');
  return (
    <section className={styles.editor} aria-label={t('bodyOf', { name: skill.name })}>
      <div className={details.nameLine}>
        <code className={styles.name}>{skill.name}</code>
        {source && <SourceMark source={source} />}
      </div>
      <p className={details.viewerDescription}>{skill.description}</p>
      {path && (
        <p className={details.viewerNote}>
          {beforePath}
          <code>{path}</code>
          {afterPath}
        </p>
      )}
      {source?.kind === 'builtin' && <p className={details.viewerNote}>{t('viewerBuiltin')}</p>}
      {skill.problem && (
        <p className={details.problem}>
          <Icon name="alert" className={details.problemIcon} />
          {skill.problem}
        </p>
      )}
      <pre className={details.viewerBody}>{skill.body.trim() === '' ? t('noBody') : skill.body}</pre>
      <div className={styles.editorActions}>
        {path && (
          <Button onClick={() => void revealSkillFolder(path).catch(reportError)}>
            <Icon name="folder" />
            {t('openFolder')}
          </Button>
        )}
        <Button onClick={onClose}>{t('close')}</Button>
      </div>
    </section>
  );
}
