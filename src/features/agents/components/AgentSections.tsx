import { useMemo } from 'react';
import { BackendTag, useAgentActivity, useBackend } from '@/features/runtime';
import { Avatar, Button, Icon, SideRow, SideSection, VisuallyHidden } from '@/shared/ui';
import type { Agent } from '@/shared/types/domain';
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
  const groups = useMemo(() => groupByPrimaryTag(agents, templates), [agents, templates]);
  return (
    <>
      {groups.map((group) => (
        <AgentSection key={group.key ?? ''} group={group} fallbackTemplateId={templates[0]?.id ?? null} />
      ))}
      <Button variant="ghost" size="sm" className={styles.add} onClick={() => openAgentCreator(null)}>
        <Icon name="plus" />
        エージェントを追加
      </Button>
    </>
  );
}

/** 区画の「＋」: テンプレートの区画はそのテンプレート、ほかのタグは最初のテンプレートにそのタグを先頭に入れる（タグなしは出さない） */
function addAction(group: TagGroup, fallbackTemplateId: string | null): { run: () => void; label: string } | undefined {
  const { template } = group;
  if (template) return { run: () => openAgentCreator(template.id), label: `${template.label}を作成` };
  if (group.key === null) return undefined;
  return {
    run: () => openAgentCreator(fallbackTemplateId, group.label),
    label: `タグ「${group.label}」のエージェントを作成`,
  };
}

function AgentSection({ group, fallbackTemplateId }: { group: TagGroup; fallbackTemplateId: string | null }) {
  const { agents } = group;
  const add = addAction(group, fallbackTemplateId);
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
          <Avatar avatar={agent.avatar} name={agent.name} color={agent.color} size="sm" busy={activity !== undefined} />
        }
        label={
          <>
            {agent.name}
            {activity && <VisuallyHidden>（動作中: {activity.detail}）</VisuallyHidden>}
          </>
        }
        trailing={<BackendTag backendId={agent.backend} />}
        title={activity?.detail ?? (backendDown ? backend.statusMessage : undefined)}
        active={activity !== undefined}
        dimmed={backendDown}
        onClick={() => openAgentEditor(agent.id)}
      />
    </li>
  );
}
