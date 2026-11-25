import { useId, useRef, useState } from 'react';
import { Button, reportError } from '@/shared/ui';
import type { ApprovalDecision, ApprovalStatus, OperationApproval } from '@/shared/types/domain';
import { chatApi } from '../api';
import { t } from '../i18n';
import styles from './OperationApprovals.module.css';

const statusLabels = {
  pending: 'approvalPending',
  approved: 'approvalApproved',
  denied: 'approvalDenied',
  timedOut: 'approvalTimedOut',
  cancelled: 'approvalCancelled',
} as const satisfies Record<ApprovalStatus, string>;

// Make control and Unicode direction formatting characters visible while retaining line breaks.
function displayText(text: string): string {
  return text.replace(/[\p{Cc}\p{Cf}]/gu, (char) => {
    if (char === '\n') return char;
    const hex = (char.codePointAt(0) ?? 0).toString(16);
    return hex.length <= 4 ? `\\u${hex.padStart(4, '0')}` : `\\u{${hex}}`;
  });
}

function OperationDetails({ card }: { card: OperationApproval }) {
  const detail = (
    <pre dir="ltr" className={styles.code}>
      {displayText(card.detail)}
    </pre>
  );
  if (card.detail.length <= 240 && card.detail.split('\n').length <= 4) return detail;
  return (
    <details>
      <summary>{t('approvalDetails')}</summary>
      {detail}
    </details>
  );
}

export function OperationApprovalCard({ card }: { card: OperationApproval }) {
  const titleId = useId();
  const submitted = useRef(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const pending = card.status === 'pending';
  const operation =
    card.operation === 'run_command'
      ? t('approvalCommand')
      : card.operation === 'write_file'
        ? t('approvalWrite')
        : displayText(card.operation);

  async function decide(decision: ApprovalDecision) {
    if (submitted.current || !pending) return;
    submitted.current = true;
    setBusy(true);
    setFailed(false);
    try {
      if (await chatApi.respondToApproval(card.channelId, card.requestId, decision)) return;
    } catch (error) {
      reportError(error);
    }
    submitted.current = false;
    setBusy(false);
    setFailed(true);
  }

  const review = (
    <>
      <p>
        {t('approvalReason')} <bdi>{displayText(card.reason)}</bdi>
      </p>
      <p>
        {t('approvalWorkspace')} <bdi>{displayText(card.workspace)}</bdi>
      </p>
      <OperationDetails card={card} />
    </>
  );

  return (
    <article className={styles.card} aria-labelledby={titleId}>
      <div id={titleId} className={styles.title}>
        {t('approvalTitle', { name: displayText(card.agentName), operation })}
      </div>
      <p role="status">{busy && pending ? t('approvalSubmitting') : t(statusLabels[card.status])}</p>
      {pending ? (
        review
      ) : (
        <details>
          <summary>{t('approvalReview')}</summary>
          {review}
        </details>
      )}
      {failed && pending && <p role="alert">{t('approvalSendFailed')}</p>}
      <div className={styles.actions} hidden={!pending}>
        <Button disabled={busy || !pending} onClick={() => void decide('approved')}>
          {t('approvalAllow')}
        </Button>
        <Button disabled={busy || !pending} onClick={() => void decide('denied')}>
          {t('approvalReject')}
        </Button>
      </div>
    </article>
  );
}
