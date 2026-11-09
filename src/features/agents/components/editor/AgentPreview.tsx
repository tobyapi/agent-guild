import { BackendTag, useBackend } from '@/features/runtime';
import { Avatar, Badge } from '@/shared/ui';
import { behaviorSummary } from '../../model/behavior';
import type { AgentDraft } from '../../model/draft';
import { leakRisk, PERMISSION_LABELS, riskyGrants } from '../../model/permissions';
import { TagBadge } from '../TagBadge';
import styles from './AgentPreview.module.css';

/** 編集ダイアログの左のプレビュー。入力するとすぐに変わる */
export function AgentPreview({ draft }: { draft: AgentDraft }) {
  const name = draft.name.trim();
  const risky = riskyGrants(draft.permissions);
  const leaky = leakRisk(useBackend(draft.backend), draft.permissions) !== null;
  const behaviors = behaviorSummary(draft);
  return (
    <aside className={styles.preview} aria-label="プレビュー">
      <Avatar avatar={draft.avatar} name={name || '？'} color={draft.color} size="lg" />
      <p className={styles.name} data-placeholder={name ? undefined : ''}>
        {name || '名前'}
      </p>
      <div className={styles.badges}>
        {draft.tags.map((tag, index) => (
          <TagBadge key={`${index}-${tag}`} tag={tag} />
        ))}
        {draft.backend && <BackendTag backendId={draft.backend} />}
      </div>
      {draft.role.trim() && <p className={styles.role}>{draft.role}</p>}
      {draft.tone.trim() && <p className={styles.tone}>口調: {draft.tone}</p>}
      {behaviors.length > 0 && (
        <div className={styles.badges} aria-label="振る舞い">
          {behaviors.map((label) => (
            <Badge key={label} tone="outline">
              {label}
            </Badge>
          ))}
        </div>
      )}
      {(risky.length > 0 || leaky) && (
        <div className={styles.badges}>
          {risky.map((key) => (
            <Badge key={key} tone="warning">
              {PERMISSION_LABELS[key]}: 許可
            </Badge>
          ))}
          {leaky && <Badge tone="warning">持ち出しの危険</Badge>}
        </div>
      )}
    </aside>
  );
}
