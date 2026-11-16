import { useState } from 'react';
import { chatApi } from '../api';
import type { SkillUsage } from '@/shared/types/domain';
import { Icon } from '@/shared/ui';
import { t } from '../i18n';
import styles from './SkillUsageLabels.module.css';

/** Only persisted metadata produces labels. Message text can never produce observed evidence. */
export function SkillUsageLabels({ usage, messageId }: { usage?: SkillUsage | null; messageId?: string }) {
  const [truncated, setTruncated] = useState<boolean | null>(null);
  return (
    <details
      className={styles.usage}
      onToggle={(event) => {
        if (event.currentTarget.open && messageId && usage?.runId) {
          void chatApi
            .skillRecordTruncated(messageId)
            .then(setTruncated)
            .catch(() => setTruncated(null));
        }
      }}
    >
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
      <p>{t('skillUsageCutoffScope')}</p>
      {truncated === true && <p>{t('skillUsageTruncated')}</p>}
      {usage?.interval && <p>{t('skillUsageOrderUnconfirmed')}</p>}
      <p>{recordStatus(usage)}</p>
      {usage?.loaded.length ? <p>{t('skillUsageInterval')}</p> : null}
    </details>
  );
}

function recordStatus(usage?: SkillUsage | null) {
  if (!usage) return t('skillUsageMissing');
  if (usage.interval?.incomplete) return t('skillUsageIncomplete');
  return t(usage.supported ? 'skillUsageSupported' : 'skillUsageUnsupported');
}
