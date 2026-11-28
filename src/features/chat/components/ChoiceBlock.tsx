import { Button } from '@/shared/ui';
import { sendChoice, useChoiceSending } from '../choiceStore';
import type { ChoiceGate, ChoiceRead } from '../model/choiceRead';
import { t } from '../i18n';
import styles from './ChoiceBlock.module.css';

const GATE_NOTES = { closed: 'choiceClosed', deleted: 'choiceDeleted', outside: 'choiceOutside' } as const;
const FALLBACK_NOTES = {
  unsupported: 'choiceUnsupported',
  partial: 'choicePartial',
  unreadable: 'choiceUnreadable',
} as const;

export interface ChoiceBlockProps {
  read: ChoiceRead;
  gate: ChoiceGate;
  channelId: string;
  messageId: string;
  authorId: string;
  /** 回答済みなら選んだ番号（一致しなければ null）。未回答なら undefined */
  answer?: number | null;
}

/** 本文の下の選択肢: 見本どおりならボタン、そうでなければ読める文章（docs/design.md §7.2） */
export function ChoiceBlock({ read, ...rest }: ChoiceBlockProps) {
  if (read.kind === 'fallback') return <ChoiceFallback read={read} />;
  return <ChoiceButtons labels={read.labels} {...rest} />;
}

function ChoiceButtons({
  labels,
  gate,
  channelId,
  messageId,
  authorId,
  answer,
}: Omit<ChoiceBlockProps, 'read'> & { labels: string[] }) {
  const sending = useChoiceSending(channelId);
  const answered = answer !== undefined && gate === 'closed';
  const note = answered
    ? t('choiceAnswered')
    : gate !== 'open'
      ? t(GATE_NOTES[gate])
      : sending
        ? t('choiceSending')
        : null;
  return (
    <div className={styles.choices}>
      <div role="group" aria-label={t('choiceGroup')} className={styles.buttons}>
        {labels.map((label, index) => (
          <Button
            key={index}
            size="sm"
            className={styles.choice}
            disabled={gate !== 'open' || sending}
            aria-pressed={answered ? answer === index : undefined}
            onClick={() => void sendChoice({ channelId, messageId, authorId, label, index })}
          >
            {answered && answer === index && (
              <span className={styles.picked} aria-hidden="true">
                ✓
              </span>
            )}
            {label}
          </Button>
        ))}
      </div>
      {note && <p className={styles.note}>{note}</p>}
    </div>
  );
}

/** ボタンにできないとき: 取り出せたラベルを文字だけで見せる（押せない・リンクにしない）。元のブロックは折りたたむ */
function ChoiceFallback({ read }: { read: Extract<ChoiceRead, { kind: 'fallback' }> }) {
  return (
    <div className={styles.choices} data-fallback="">
      <p className={styles.note}>{t(FALLBACK_NOTES[read.reason])}</p>
      {read.labels.length > 0 && (
        <ul className={styles.labels}>
          {read.labels.map((label, index) => (
            <li key={index}>{label}</li>
          ))}
        </ul>
      )}
      {read.raw !== null && (
        <details className={styles.raw}>
          <summary>{t('choiceRaw')}</summary>
          <pre>{read.raw}</pre>
        </details>
      )}
    </div>
  );
}
