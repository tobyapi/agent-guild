import type { ReactNode } from 'react';
import { Avatar, Icon, Lamp } from '@/shared/ui';
import type { Subtask, SubtaskStatus } from '@/shared/types/domain';
import { jumpToMessage } from '../jump';
import type { AuthorView } from '../model/authors';
import { resultLink, SUBTASK_STATUS_TEXT, subtaskNote } from '../model/delegations';
import styles from './SubtaskRow.module.css';

/** 状態の印（16px）。状態は必ず隣の言葉でも出す */
const STATUS_MARKS: Readonly<Record<SubtaskStatus, ReactNode>> = {
  pending: <Lamp waiting />,
  running: <Lamp />,
  done: <Icon name="check" />,
  failed: <Icon name="alert" />,
  cancelled: <Icon name="minus" />,
};

/** サブタスクの行（tasks ブロックの順のまま）: [印][アバター][名前][状態の言葉・導線] の下に指示（3 行まで）と理由 */
export function SubtaskRow({ subtask, assignee }: { subtask: Subtask; assignee: AuthorView }) {
  const link = resultLink(subtask);
  const note = subtaskNote(subtask);
  return (
    <li className={styles.row} data-status={subtask.status}>
      <span className={styles.mark}>{STATUS_MARKS[subtask.status]}</span>
      <Avatar avatar={assignee.avatar} name={assignee.name} color={assignee.color} size="xs" deleted={assignee.deleted} />
      <span className={styles.name}>{assignee.name}</span>
      <span className={styles.state}>
        <b className={styles.word}>{SUBTASK_STATUS_TEXT[subtask.status]}</b>
        {link && (
          <button type="button" className={styles.jump} onClick={() => jumpToMessage(link.messageId)}>
            {link.label}
          </button>
        )}
      </span>
      <p className={styles.text} title={subtask.instruction}>
        {subtask.instruction}
      </p>
      {note && <p className={styles.note}>{note}</p>}
    </li>
  );
}
