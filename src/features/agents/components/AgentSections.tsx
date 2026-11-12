import { BackendTag, useAgentActivity, useBackend } from '@/features/runtime';
import { MemberAvatar } from '@/features/frames';
import { Button, Icon, SideRow, SideSection, VisuallyHidden } from '@/shared/ui';
import type { Agent } from '@/shared/types/domain';
import { tEditor } from '../i18n/editor';
import { useActiveAgents, useTemplates } from '../hooks/useAgents';
import { groupByPrimaryTag } from '../model/groups';
import type { TagGroup } from '../model/groups';
import { openAgentCreator, openAgentEditor } from '../store';
import { AccentMark } from './AccentMark';
import styles from './AgentSections.module.css';

/**
 * サイドバーのエージェント: エージェントのいる先頭のタグの区画だけを（テンプレートの順 → ほかのタグは五十音 → タグなし）並べ、
 * その下に作成の入口［＋ エージェントを追加］（テンプレートを選ぶ作成画面）。区画の「＋」はその区画のタグを先頭に入れて開く。
 * 行を押すと編集ダイアログを開く
 */
export function AgentSections() {
  const agents = useActiveAgents();
  const templates = useTemplates();
  // 区分の見出し（タグなし）と並び順は言語で変わるので、描画のたびに求める（数は少ない）
  const groups = groupByPrimaryTag(agents, templates);
  return (
    <>
      {groups.map((group) => (
        <AgentSection key={group.key ?? ''} group={group} />
      ))}
      <Button variant="ghost" size="sm" className={styles.add} onClick={() => openAgentCreator(null)}>
        <Icon name="plus" />
        {tEditor('addAgent')}
      </Button>
    </>
  );
}

/** 区画の「＋」: 対応するテンプレートがなければタグだけを入れる（タグなしは出さない） */
function addAction(group: TagGroup): { run: () => void; label: string } | undefined {
  const { template } = group;
  if (template)
    return {
      run: () => openAgentCreator(template.id),
      label: tEditor('createFromTemplate', { label: template.label }),
    };
  if (group.key === null) return undefined;
  return {
    run: () => openAgentCreator(null, group.label),
    label: tEditor('createWithTag', { tag: group.label }),
  };
}

function AgentSection({ group }: { group: TagGroup }) {
  const { agents } = group;
  const add = addAction(group);
  return (
    <SideSection
      title={group.label}
      mark={<AccentMark accent={group.accent} />}
      count={agents.length}
      onAdd={add?.run}
      addLabel={add?.label}
    >
      {agents.map((agent) => (
        <AgentRow key={agent.id} agent={agent} />
      ))}
    </SideSection>
  );
}

function AgentRow({ agent }: { agent: Agent }) {
  const activity = useAgentActivity(agent.id);
  const backend = useBackend(agent.backend);
  const backendDown = backend !== undefined && backend.status !== 'ready';
  return (
    <li>
      <SideRow
        leading={
          <MemberAvatar
            avatar={agent.avatar}
            name={agent.name}
            color={agent.color}
            frame={agent.frame}
            size="sm"
            busy={activity !== undefined}
          />
        }
        label={
          <>
            {agent.name}
            {activity && <VisuallyHidden>{tEditor('busyActivity', { detail: activity.detail })}</VisuallyHidden>}
          </>
        }
        trailing={<BackendTag backendId={agent.backend} />}
        title={activity?.detail ?? (backendDown ? backend.statusMessage : undefined)}
        active={activity !== undefined}
        dimmed={backendDown}
        onClick={() => openAgentEditor(agent.id)}
        className={styles.agentRow}
      />
    </li>
  );
}
