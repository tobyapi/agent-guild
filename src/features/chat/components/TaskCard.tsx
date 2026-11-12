import { Icon, Lamp } from '@/shared/ui';
import type { Delegation } from '@/shared/types/domain';
import { useAuthorResolver } from '../hooks/useAuthorResolver';
import { jumpToMessage } from '../jump';
import { delegationStateText, progressText } from '../model/delegations';
import { SubtaskRow } from './SubtaskRow';
import { t } from '../i18n';
import styles from './TaskCard.module.css';

/**
 * 割り振りのカード（docs/ui-design.md §5.13）。発言の tasks ブロックの代わりに、本文の下に置く。
 * 状態はサブタスクが data-status、全体が data-state。delegation-changed で開いたまま更新される
 */
export function TaskCard({ delegation }: { delegation: Delegation }) {
  const resolve = useAuthorResolver();
  const progress = progressText(delegation);
  return (
    <section className={styles.card} data-state={delegation.status} aria-label={t('delegationLabel', { progress })}>
      <header className={styles.head}>
        <span className={styles.title}>{t('delegationTitle')}</span>
        <span className={styles.progress} aria-live="polite">
          {progress}
        </span>
        <span className={styles.state}>
          {delegation.status === 'running' || delegation.status === 'reporting' ? <Lamp /> : null}
          {delegation.status === 'done' && <Icon name="check" />}
          {delegationStateText(delegation.status)}
        </span>
      </header>
      <div className={styles.bar} aria-hidden="true">
        {delegation.subtasks.map((subtask) => (
          <span key={subtask.id} className={styles.segment} data-status={subtask.status} />
        ))}
      </div>
      <ol className={styles.rows}>
        {delegation.subtasks.map((subtask) => (
          <SubtaskRow key={subtask.id} subtask={subtask} assignee={resolve(subtask.assigneeId)} />
        ))}
      </ol>
      <CardFooter delegation={delegation} managerName={resolve(delegation.managerId).name} />
    </section>
  );
}

/** 足元: まとめ中は書いている人、完了はまとめへの導線、打ち切りはその旨（進行中は出さない） */
function CardFooter({ delegation, managerName }: { delegation: Delegation; managerName: string }) {
  const { status, summaryMessageId } = delegation;
  if (status === 'running') return null;
  const [beforeName, afterName] = t('summaryWriting').split('{name}');
  return (
    <footer className={styles.foot}>
      {status === 'reporting' && (
        <>
          <Lamp />
          <span>
            {beforeName}
            <b>{managerName}</b>
            {afterName}
          </span>
        </>
      )}
      {status === 'done' && summaryMessageId !== null && (
        <button type="button" className={styles.jump} onClick={() => jumpToMessage(summaryMessageId)}>
          {t('viewSummary')}
        </button>
      )}
      {status === 'done' && summaryMessageId === null && <span className={styles.muted}>{t('noSummary')}</span>}
      {status === 'cancelled' && <span className={styles.muted}>{t('cancelledNote')}</span>}
    </footer>
  );
}
