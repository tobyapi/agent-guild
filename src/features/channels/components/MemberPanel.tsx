import { useMemo, useState } from 'react';
import { AccentMark, HUMAN_ACCENT, openAgentEditor, useActiveAgents, useTemplates } from '@/features/agents';
import { useProfile } from '@/features/profile';
import { BackendTag, useAgentActivity, useBackend } from '@/features/runtime';
import { MemberAvatar } from '@/features/frames';
import { Button, Icon, IconButton, reportError, SideSection } from '@/shared/ui';
import type { Agent, Channel } from '@/shared/types/domain';
import { memberGroups } from '../model/channels';
import { MEMBER_PANEL_ID } from '../model/ids';
import { removeChannelMember } from '../store';
import { AddMembersDialog } from './AddMembersDialog';
import { t } from '../i18n';
import styles from './MemberPanel.module.css';

/** 右のメンバーパネル: あなた・先頭のタグごとのエージェント・メンバーの追加 */
export function MemberPanel({ channel }: { channel: Channel }) {
  const agents = useActiveAgents();
  const templates = useTemplates();
  const me = useProfile();
  const groups = useMemo(() => memberGroups(channel, agents, templates), [channel, agents, templates]);
  const [adding, setAdding] = useState(false);
  const total = 1 + groups.reduce((sum, group) => sum + group.agents.length, 0);
  return (
    <aside id={MEMBER_PANEL_ID} className={styles.panel} aria-label={t('memberPanel')}>
      <div className={styles.head}>
        <h2 className={styles.title}>{t('members')}</h2>
        <span className={styles.count}>{total}</span>
      </div>
      <div className={styles.scroll}>
        <SideSection title={t('you')} mark={<AccentMark accent={HUMAN_ACCENT} human />}>
          <li className={styles.row}>
            <MemberAvatar avatar={me.avatar} name={me.name} color={me.color} frame={me.frame} size="row" human />
            <div className={styles.text}>
              <span className={styles.name}>
                {me.name}
                <span className={styles.you}>{t('you')}</span>
              </span>
            </div>
          </li>
        </SideSection>
        {groups.map(({ key, label, accent, agents: members }) => (
          <SideSection key={key ?? ''} title={label} mark={<AccentMark accent={accent} />} count={members.length}>
            {members.map((agent) => (
              <MemberRow key={agent.id} agent={agent} channelId={channel.id} />
            ))}
          </SideSection>
        ))}
        {total === 1 && (
          <p className={styles.alone}>
            <b>{t('aloneTitle')}</b>
            {t('aloneText')}
          </p>
        )}
      </div>
      <div className={styles.foot}>
        <Button variant="ghost" className={styles.add} onClick={() => setAdding(true)}>
          <Icon name="plus" />
          {t('addMembers')}
        </Button>
      </div>
      {adding && <AddMembersDialog channel={channel} onClose={() => setAdding(false)} />}
    </aside>
  );
}

function MemberRow({ agent, channelId }: { agent: Agent; channelId: string }) {
  const activity = useAgentActivity(agent.id);
  const backend = useBackend(agent.backend);
  return (
    <li className={styles.row} title={activity?.detail}>
      <MemberAvatar
        avatar={agent.avatar}
        name={agent.name}
        color={agent.color}
        frame={agent.frame}
        size="row"
        busy={activity !== undefined}
      />
      <div className={styles.text}>
        <span className={styles.name}>{agent.name}</span>
        <span className={styles.sub}>
          {backend && backend.status !== 'ready' && <BackendTag backendId={agent.backend} />}
          {agent.role && <span className={styles.role}>{agent.role}</span>}
        </span>
      </div>
      <div className={styles.rowActions}>
        <IconButton label={t('editAgent', { name: agent.name })} onClick={() => openAgentEditor(agent.id)}>
          <Icon name="edit" />
        </IconButton>
        <IconButton
          label={t('removeMember', { name: agent.name })}
          onClick={() => void removeChannelMember(channelId, agent.id).catch(reportError)}
        >
          <Icon name="close" />
        </IconButton>
      </div>
    </li>
  );
}
