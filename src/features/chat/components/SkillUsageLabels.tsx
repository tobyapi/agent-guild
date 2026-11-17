import { useState } from 'react';
import { chatApi } from '../api';
import type { SkillUsage } from '@/shared/types/domain';
import { Icon } from '@/shared/ui';
import { t } from '../i18n';
import { validSkillName } from '../model/skillUsage';
import styles from './SkillUsageLabels.module.css';

/** Only persisted metadata produces labels. Message text can never produce observed evidence. */
export function SkillUsageLabels({ usage, messageId }: { usage?: SkillUsage | null; messageId?: string }) {
  const [truncated, setTruncated] = useState<boolean | null>(null);
  const declared = validNames(usage?.declared);
  const loaded = validNames(usage?.loaded);
  if (declared.length === 0 && loaded.length === 0) return null;
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
        {declared.map((name) => (
          <span className={styles.label} key={`declared:${name}`}>
            {t('skillUsageDeclared')}
            <span>{name}</span>
          </span>
        ))}
        {!usage?.interval?.incomplete &&
          loaded.map((name) => (
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
      {loaded.length > 0 && <p>{t('skillUsageInterval')}</p>}
    </details>
  );
}

function validNames(names?: string[]) {
  return (names ?? []).filter(validSkillName);
}

function recordStatus(usage?: SkillUsage | null) {
  if (!usage) return t('skillUsageMissing');
  if (usage.interval?.incomplete) return t('skillUsageIncomplete');
  return t(usage.supported ? 'skillUsageSupported' : 'skillUsageUnsupported');
}
