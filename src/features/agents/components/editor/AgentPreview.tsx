import { MemberAvatar } from '@/features/frames';
import { BackendTag, useBackend } from '@/features/runtime';
import { Badge } from '@/shared/ui';
import { tEditor } from '../../i18n/editor';
import { behaviorSummary } from '../../model/behavior';
import type { AgentDraft } from '../../model/draft';
import { modelPermissions } from '@/shared/lib/permissionPolicy';
import { leakRisk, permissionText, riskyGrants } from '../../model/permissions';
import { TagBadge } from '../TagBadge';
import styles from './AgentPreview.module.css';

/** 編集ダイアログの左のプレビュー。入力するとすぐに変わる */
export function AgentPreview({ draft }: { draft: AgentDraft }) {
  const name = draft.name.trim();
  // 注意の札は、役割の権限のうちこの AI で実際に使える操作について出す
  const backend = useBackend(draft.backend);
  const usable = modelPermissions(draft.permissions, backend, draft.model, draft.optionValues);
  const risky = riskyGrants(usable);
  const leaky = leakRisk(backend, usable) !== null;
  const behaviors = behaviorSummary(draft);
  return (
    <aside className={styles.preview} aria-label={tEditor('previewLabel')}>
      <MemberAvatar
        avatar={draft.avatar}
        name={name || tEditor('unnamedInitial')}
        color={draft.color}
        frame={draft.frame}
        size="lg"
        className={styles.avatar}
      />
      <p className={styles.name} data-placeholder={name ? undefined : ''}>
        {name || tEditor('namePlaceholder')}
      </p>
      <div className={styles.badges}>
        {draft.tags.map((tag, index) => (
          <TagBadge key={`${index}-${tag}`} tag={tag} />
        ))}
        {draft.backend && <BackendTag backendId={draft.backend} />}
      </div>
      {draft.role.trim() && <p className={styles.role}>{draft.role}</p>}
      {draft.tone.trim() && <p className={styles.tone}>{tEditor('toneLine', { tone: draft.tone })}</p>}
      {behaviors.length > 0 && (
        <div className={styles.badges} aria-label={tEditor('behaviorsLabel')}>
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
              {tEditor('permissionAllowed', { label: permissionText(key).label })}
            </Badge>
          ))}
          {leaky && <Badge tone="warning">{tEditor('leakRisk')}</Badge>}
        </div>
      )}
    </aside>
  );
}
