import { channelTitle } from '@/shared/lib/channelIcon';
import { formatDateTime, formatDayLabel, formatTime, isoTime } from '@/shared/lib/time';
import { Button, Icon } from '@/shared/ui';
import type { IconName } from '@/shared/ui';
import type { Channel, Message } from '@/shared/types/domain';
import { noticeIcon, splitLeadingName } from '../model/systemNotice';
import type { NoticeIcon } from '../model/systemNotice';
import { t } from '../i18n';
import styles from './MessageList.module.css';

const NOTICE_ICONS: Readonly<Record<NoticeIcon, IconName>> = {
  join: 'join',
  stop: 'stop',
  limit: 'alert',
  other: 'diamond',
};

/** 日付の区切り: 中央に「今日」「11月7日（金）」、左右に細線 */
export function DaySeparator({ at, today }: { at: number; today: number }) {
  return (
    <p className={styles.day}>
      <span>{formatDayLabel(at, today)}</span>
    </p>
  );
}

/** システム発言: 左の列に線画アイコン、文は Rust の文面のまま（先頭の名前だけ強調）、末尾に時刻 */
export function SystemNotice({ message, names }: { message: Message; names: readonly string[] }) {
  const parts = splitLeadingName(message.content, names);
  return (
    <div className={styles.system}>
      <Icon name={NOTICE_ICONS[noticeIcon(message.content)]} className={styles.systemIcon} />
      <p className={styles.systemText}>
        {parts ? (
          <>
            <b className={styles.systemName}>{parts.name}</b>
            {parts.rest}
          </>
        ) : (
          message.content
        )}
        <time
          className={styles.systemTime}
          dateTime={isoTime(message.createdAt)}
          title={formatDateTime(message.createdAt)}
        >
          {formatTime(message.createdAt)}
        </time>
      </p>
    </div>
  );
}

export interface LogStartProps {
  channel: Channel;
  ready: boolean;
  hasMore: boolean;
  loadingOlder: boolean;
  onLoadOlder: () => void;
}

/** 一覧の先頭: 読み込み中 / 過去を読む / チャンネルのはじまり */
export function LogStart({ channel, ready, hasMore, loadingOlder, onLoadOlder }: LogStartProps) {
  if (!ready) return <p className={styles.status}>{t('loading')}</p>;
  if (loadingOlder) return <p className={styles.status}>{t('loadingOlder')}</p>;
  if (hasMore) {
    return (
      <div className={styles.status}>
        <Button size="sm" variant="ghost" onClick={onLoadOlder}>
          {t('loadOlder')}
        </Button>
      </div>
    );
  }
  return (
    <div className={styles.intro}>
      <h2 className={styles.introTitle}>{t('welcome', { channel: channelTitle(channel) })}</h2>
      <p className={styles.introText}>
        {/* 話題と案内の間は日本語では全角スペース（docs/ui-design.md §7 の文例どおり） */}
        {channel.topic && `${channel.topic}${t('introSpacer')}`}
        {t('intro', { channel: channel.name })}
      </p>
    </div>
  );
}
