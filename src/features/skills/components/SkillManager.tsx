import { useState } from 'react';
import { Button, Icon } from '@/shared/ui';
import type { Skill } from '@/shared/types/domain';
import { useAgentSkills } from '../hooks/useAgentSkills';
import { DeleteSkillDialog } from './DeleteSkillDialog';
import { LibraryPicker } from './LibraryPicker';
import { SkillEditor } from './SkillEditor';
import { SkillRow } from './SkillRow';
import { SkillViewer } from './SkillViewer';
import styles from './SkillManager.module.css';

export interface SkillManagerProps {
  agentId: string;
  /** はじめから開いておく（相談相手になる人など、スキルが要のとき） */
  defaultOpen: boolean;
  /** ライブラリが未設定のとき、設定の「スキルのフォルダ」を開く */
  onOpenLibrarySettings: () => void;
}

/** 一覧の下に開く作業の場所（1つずつ） */
type Panel = { type: 'edit'; skill: Skill | null } | { type: 'view'; skill: Skill } | { type: 'library' };

/** エージェントのスキルの一覧・作成・編集・ライブラリからの追加・削除（リンクしたスキルは見るだけ） */
export function SkillManager({ agentId, defaultOpen, onOpenLibrarySettings }: SkillManagerProps) {
  const skills = useAgentSkills(agentId);
  const [panel, setPanel] = useState<Panel | null>(null);
  const [deleting, setDeleting] = useState<Skill | null>(null);
  const list = skills ?? [];
  const close = () => setPanel(null);

  return (
    <section className={styles.manager}>
      <details className={styles.details} open={defaultOpen}>
        <summary className={styles.summary}>
          スキル<span className={styles.count}>{skills ? list.length : '…'}</span>
        </summary>
        <div className={styles.content}>
          {list.length === 0 && panel === null && skills && (
            <p className={styles.empty}>
              <b>スキルはまだありません</b>
              専門知識の手引きを Markdown で書くか、スキルのフォルダから追加すると、相談のときに読んでから答えます。
            </p>
          )}
          <ul className={styles.list}>
            {list.map((skill) => (
              <SkillRow
                key={skill.id}
                skill={skill}
                onEdit={() => setPanel({ type: 'edit', skill })}
                onView={() => setPanel({ type: 'view', skill })}
                onDelete={() => setDeleting(skill)}
              />
            ))}
          </ul>
          {panel === null ? (
            <div className={styles.addActions}>
              <Button size="sm" variant="ghost" onClick={() => setPanel({ type: 'edit', skill: null })}>
                <Icon name="plus" />
                スキルを書く
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setPanel({ type: 'library' })}>
                <Icon name="link" />
                ライブラリから追加
              </Button>
            </div>
          ) : (
            <PanelView
              panel={panel}
              agentId={agentId}
              skills={list}
              onClose={close}
              onOpenLibrarySettings={onOpenLibrarySettings}
            />
          )}
        </div>
      </details>
      {deleting && <DeleteSkillDialog skill={deleting} onClose={() => setDeleting(null)} />}
    </section>
  );
}

interface PanelViewProps extends Pick<SkillManagerProps, 'agentId' | 'onOpenLibrarySettings'> {
  panel: Panel;
  skills: readonly Skill[];
  onClose: () => void;
}

/** 一覧の下の作業の場所: スキルを書く・リンクしたスキルを見る・ライブラリから追加 */
function PanelView({ panel, agentId, skills, onClose, onOpenLibrarySettings }: PanelViewProps) {
  switch (panel.type) {
    case 'edit':
      return (
        <SkillEditor
          key={panel.skill?.id ?? 'new'}
          agentId={agentId}
          skill={panel.skill}
          existing={skills}
          onDone={onClose}
        />
      );
    case 'view': {
      // 一覧が取り直されたら新しい内容を見せる
      const current = skills.find((skill) => skill.id === panel.skill.id) ?? panel.skill;
      return <SkillViewer key={current.id} skill={current} onClose={onClose} />;
    }
    case 'library':
      return (
        <LibraryPicker agentId={agentId} existing={skills} onClose={onClose} onOpenSettings={onOpenLibrarySettings} />
      );
  }
}
