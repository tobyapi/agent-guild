import { Icon } from '@/shared/ui';
import { t } from '../i18n';
import styles from './SkillUsageLabels.module.css';

/** 申告の根拠を開ける。読み取り・実行を確認したという表示にはしない。 */
export function SkillUsageLabels({ names }: { names: readonly string[] }) {
  if (names.length === 0) return null;
  return (
    <details className={styles.usage}>
      <summary>
        <Icon name="chevron" />
        <span>{t('skillUsageDeclared')}</span>
        {names.map((name) => (
          <span className={styles.label} key={name}>
            {name}
          </span>
        ))}
      </summary>
      <p>{t('skillUsageEvidence')}</p>
    </details>
  );
}
