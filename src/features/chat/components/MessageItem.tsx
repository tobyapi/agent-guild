import { memo } from 'react';
import { TagBadge } from '@/features/agents';
import { BackendTag } from '@/features/runtime';
import { removeTasksBlock } from '@/shared/lib/tasksBlock';
import { formatDateTime, formatTime, isoTime } from '@/shared/lib/time';
import { Avatar, Badge, Icon } from '@/shared/ui';
import type { Delegation, Message } from '@/shared/types/domain';
import { jumpToMessage, messageElementId } from '../jump';
import type { HighlightPhase } from '../jump';
import type { AuthorView } from '../model/authors';
import type { TaskLink } from '../model/delegations';
import { MessageAttachments } from './MessageAttachments';
import { MessageBody } from './MessageBody';
import { TaskCard } from './TaskCard';
import styles from './Message.module.css';

const TASK_LINK_TEXT: Readonly<Record<TaskLink['kind'], string>> = {
  result: '割り振りの結果',
  summary: '割り振りのまとめ',
};

export interface MessageItemProps {
  message: Message;
  author: AuthorView;
  /** まとまりの先頭（アバターと見出しを出す） */
  head: boolean;
  /** ライブで届いた発言（登場の動きをつける） */
  live: boolean;
  /** 自分が呼ばれている（行を目立たせる） */
  mentionsMe: boolean;
  renderBody: (content: string) => string;
  /** この発言（tasks ブロック）から作られた割り振り。delegationId があってまだ読めていなければ undefined */
  delegation: Delegation | undefined;
  /** 割り振りの結果・まとめの発言なら、カードへ戻る導線（見出しの札） */
  taskLink: TaskLink | undefined;
  /** 「結果を見る」などで移ってきた発言の光らせ方 */
  highlight: HighlightPhase | undefined;
}

/** 1件の発言。先頭ならアバターと見出し、続きなら左の列に時刻（ホバーで見える） */
export const MessageItem = memo(function MessageItem(props: MessageItemProps) {
  const { message, author, head, live, mentionsMe, highlight, taskLink } = props;
  return (
    <article
      id={messageElementId(message.id)}
      className={styles.message}
      data-head={head ? '' : undefined}
      data-live={live ? '' : undefined}
      data-self={mentionsMe ? '' : undefined}
      data-deleted={author.deleted ? '' : undefined}
      data-highlight={highlight}
    >
      {head ? (
        <Avatar
          avatar={author.avatar}
          name={author.name}
          color={author.color}
          human={author.human}
          deleted={author.deleted}
          className={styles.avatar}
        />
      ) : (
        <time className={styles.gutter} dateTime={isoTime(message.createdAt)} title={formatDateTime(message.createdAt)}>
          {formatTime(message.createdAt)}
        </time>
      )}
      {head && <MessageHeader message={message} author={author} taskLink={taskLink} />}
      <MessageContent {...props} />
    </article>
  );
});

/** 見出しの下: 本文（エラー発言は理由）と、割り振りのカード（tasks ブロックの代わり） */
function MessageContent({ message, renderBody, delegation }: MessageItemProps) {
  const content = message.delegationId === null ? message.content : removeTasksBlock(message.content);
  return (
    <>
      {message.kind === 'error' && <ErrorBody content={message.content} />}
      {message.kind !== 'error' && content !== '' && <MessageBody content={content} render={renderBody} />}
      <MessageAttachments message={message} />
      {message.delegationId !== null &&
        (delegation ? (
          <TaskCard delegation={delegation} />
        ) : (
          <p className={styles.taskLoading}>タスクを読み込んでいます…</p>
        ))}
    </>
  );
}

function MessageHeader({
  message,
  author,
  taskLink,
}: {
  message: Message;
  author: AuthorView;
  taskLink: TaskLink | undefined;
}) {
  return (
    <header className={styles.header}>
      <span className={styles.name}>{author.name}</span>
      {author.deleted && <span className={styles.deletedNote}>（削除済み）</span>}
      {author.tag && <TagBadge tag={author.tag} />}
      {author.backend && <BackendTag backendId={author.backend} showStatus={false} />}
      {message.kind === 'autonomous' && <Badge tone="autonomous">💡 自発</Badge>}
      {message.kind === 'progress' && (
        <Badge tone="outline" title="作業の途中の投稿（最後の返答は別に届きます）">
          途中経過
        </Badge>
      )}
      {taskLink && (
        <button type="button" className={styles.taskLink} onClick={() => jumpToMessage(taskLink.planMessageId)}>
          {taskLink.kind === 'result' && <Icon name="return" />}
          {TASK_LINK_TEXT[taskLink.kind]}
        </button>
      )}
      <time className={styles.time} dateTime={isoTime(message.createdAt)} title={formatDateTime(message.createdAt)}>
        {formatTime(message.createdAt)}
      </time>
    </header>
  );
}

/** エラー発言: 本文の代わりに「返答できませんでした」と理由 */
function ErrorBody({ content }: { content: string }) {
  return (
    <div className={styles.error}>
      <b className={styles.errorTitle}>
        <Icon name="alert" />
        返答できませんでした
      </b>
      <span className={styles.errorText}>{content}</span>
    </div>
  );
}
