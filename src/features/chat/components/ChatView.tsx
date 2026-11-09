import type { Channel } from '@/shared/types/domain';
import { ActivityBar } from './ActivityBar';
import { Composer } from './Composer';
import { MessageList } from './MessageList';
import styles from './ChatView.module.css';

/** 中央の会話: メッセージ一覧・動作中表示・入力欄 */
export function ChatView({ channel }: { channel: Channel }) {
  return (
    <div className={styles.chat}>
      <MessageList channel={channel} />
      <ActivityBar channelId={channel.id} />
      <Composer key={channel.id} channel={channel} />
    </div>
  );
}
