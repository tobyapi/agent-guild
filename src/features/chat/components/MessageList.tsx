import { useMemo, useRef } from 'react';
import { useProfile } from '@/features/profile';
import { Icon } from '@/shared/ui';
import type { Channel } from '@/shared/types/domain';
import { useAuthorResolver, useKnownNames } from '../hooks/useAuthorResolver';
import { useChannelDelegations } from '../hooks/useChannelDelegations';
import { useChannelLog } from '../hooks/useChannelLog';
import { useMessageRenderer } from '../hooks/useMessageRenderer';
import { useMessageScroll } from '../hooks/useMessageScroll';
import { useToday } from '../hooks/useToday';
import { useJumpStore } from '../jump';
import { mentionsHuman } from '../model/messages';
import { buildTimeline } from '../model/timeline';
import { MessageItem } from './MessageItem';
import { DaySeparator, LogStart, SystemNotice } from './TimelineParts';
import styles from './MessageList.module.css';

/** メッセージ一覧（日付の区切り・システム発言・同じ人の連続投稿のまとまり） */
export function MessageList({ channel }: { channel: Channel }) {
  const log = useChannelLog(channel.id);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const scroll = useMessageScroll({
    scrollerRef,
    contentRef,
    channelId: channel.id,
    messages: log.messages,
    canLoadOlder: log.hasMore && !log.loadingOlder,
    onLoadOlder: log.requestOlder,
  });
  const delegations = useChannelDelegations(channel.id);
  // 結果・まとめの発言は見出しに札を出すので、必ず新しいまとまりを始める
  const items = useMemo(
    () => buildTimeline(log.messages, (message) => delegations.links.has(message.id)),
    [log.messages, delegations.links],
  );
  const today = useToday();
  const renderBody = useMessageRenderer();
  const resolveAuthor = useAuthorResolver();
  const names = useKnownNames();
  const me = useProfile();
  const highlight = useJumpStore((state) => state.highlight);

  return (
    <div className={styles.frame}>
      <div ref={scrollerRef} className={styles.scroller} onScroll={scroll.onScroll}>
        <div ref={contentRef} className={styles.content} role="log" aria-label={`#${channel.name} のメッセージ`}>
          <LogStart
            channel={channel}
            ready={log.ready}
            hasMore={log.hasMore}
            loadingOlder={log.loadingOlder}
            onLoadOlder={scroll.requestOlder}
          />
          {items.map((item) => {
            if (item.type === 'day') return <DaySeparator key={item.key} at={item.at} today={today} />;
            if (item.type === 'system') return <SystemNotice key={item.key} message={item.message} names={names} />;
            const author = resolveAuthor(item.authorId);
            return item.messages.map((message, index) => (
              <MessageItem
                key={message.id}
                message={message}
                author={author}
                head={index === 0}
                live={message.seq > log.liveAfterSeq}
                mentionsMe={mentionsHuman(message, me.name)}
                renderBody={renderBody}
                delegation={message.delegationId === null ? undefined : delegations.byId[message.delegationId]}
                taskLink={delegations.links.get(message.id)}
                highlight={highlight?.messageId === message.id ? highlight.phase : undefined}
              />
            ));
          })}
        </div>
      </div>
      {scroll.showJump && (
        <button type="button" className={styles.jump} onClick={scroll.jumpToBottom}>
          新しいメッセージ
          <Icon name="arrowDown" />
        </button>
      )}
    </div>
  );
}
