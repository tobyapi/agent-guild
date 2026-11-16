import type { SkillUsage } from '@/shared/types/domain';
import { Icon } from '@/shared/ui';
import { t } from '../i18n';
import styles from './SkillUsageLabels.module.css';

/** Only persisted metadata produces labels. Message text can never produce observed evidence. */
export function SkillUsageLabels({ usage }: { usage?: SkillUsage | null }) {
  return (
    <details className={styles.usage}>
      <summary>
        <Icon name="chevron" />
        <span>{t('skillUsageDetails')}</span>
        {usage?.declared.map((name) => (
          <span className={styles.label} key={`declared:${name}`}>
            {t('skillUsageDeclared')}
            <span>{name}</span>
          </span>
        ))}
        {!usage?.interval?.incomplete &&
          usage?.loaded.map((name) => (
            <span className={styles.label} key={`loaded:${name}`}>
              {t('skillUsageLoaded')}
              <span>{name}</span>
            </span>
          ))}
      </summary>
      <p>{t('skillUsageEvidence')}</p>
      <p>
        {!usage
          ? t('skillUsageMissing')
          : usage.interval?.incomplete
            ? t('skillUsageIncomplete')
            : usage.supported
              ? t('skillUsageSupported')
              : t('skillUsageUnsupported')}
      </p>
      {usage?.loaded.length ? <p>{t('skillUsageInterval')}</p> : null}
    </details>
  );
}
