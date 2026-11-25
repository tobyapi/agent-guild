import { useEffect } from 'react';
import { useLanguage } from '@/shared/i18n';
import { reportError } from '@/shared/ui';
import { t } from '../i18n';
import { loadOperationApprovals, useOperationApprovals } from '../operationApprovalStore';
import { OperationApprovalCard } from './OperationApprovalCard';
import styles from './OperationApprovals.module.css';

export function OperationApprovals({ channelId }: { channelId: string }) {
  useLanguage();
  const cards = useOperationApprovals((state) => state.cards).filter((card) => card.channelId === channelId);
  useEffect(() => {
    void loadOperationApprovals(channelId).catch(reportError);
  }, [channelId]);

  if (cards.length === 0) return null;
  return (
    <section className={styles.panel} aria-label={t('approvalPanel')}>
      {[...cards].reverse().map((card) => (
        <OperationApprovalCard key={card.requestId} card={card} />
      ))}
    </section>
  );
}
