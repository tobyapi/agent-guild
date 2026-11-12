import { useAllAgents } from '@/features/agents';
import { useChannelActivities } from '@/features/runtime';
import { Lamp, VisuallyHidden } from '@/shared/ui';
import { activityPhrase, splitVisible } from '../model/activity';
import { tComposer } from '../i18n/composer';
import styles from './ActivityBar.module.css';

/**
 * 動作中表示（入力欄のすぐ上。docs/ui-design.md §5.5）: 「ハル が Web検索中: …」を 1 人 1 行。
 * 誰も動いていなければ何も出さない。読み上げは開始と終了（名前の顔ぶれの変化）だけにする。
 */
export function ActivityBar({ channelId }: { channelId: string }) {
  const activities = useChannelActivities(channelId);
  const agents = useAllAgents();
  const nameOf = (agentId: string) => agents.find((agent) => agent.id === agentId)?.name ?? '…';
  const { visible, hidden } = splitVisible(activities);
  const names = activities.map((activity) => nameOf(activity.agentId));
  return (
    <div className={styles.bar}>
      <VisuallyHidden>
        <span aria-live="polite">
          {names.length > 0
            ? tComposer('activityWorking', { names: names.join(tComposer('nameSeparator')), count: names.length })
            : ''}
        </span>
      </VisuallyHidden>
      {visible.map((activity) => (
        <p key={activity.agentId} className={styles.line} aria-hidden="true">
          <Lamp />
          <span className={styles.text}>
            <b className={styles.name}>{nameOf(activity.agentId)}</b> {activityPhrase(activity.detail)}
          </span>
        </p>
      ))}
      {hidden > 0 && (
        <p className={styles.line} aria-hidden="true">
          {tComposer('activityOthers', { count: hidden })}
        </p>
      )}
    </div>
  );
}
