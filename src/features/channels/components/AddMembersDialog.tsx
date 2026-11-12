import { useMemo, useState } from 'react';
import { PrimaryTagBadge, useActiveAgents } from '@/features/agents';
import { Avatar, Button, Dialog, reportError } from '@/shared/ui';
import type { Agent, Channel } from '@/shared/types/domain';
import { addableAgents } from '../model/channels';
import { addChannelMember } from '../store';
import { t } from '../i18n';
import styles from './AddMembersDialog.module.css';

export interface AddMembersDialogProps {
  channel: Channel;
  onClose: () => void;
}

/** メンバーの追加: まだいないエージェントを一覧から加える */
export function AddMembersDialog({ channel, onClose }: AddMembersDialogProps) {
  const agents = useActiveAgents();
  const candidates = useMemo(() => addableAgents(channel, agents), [channel, agents]);
  return (
    <Dialog
      size="sm"
      title={t('addTitle', { name: channel.name })}
      onClose={onClose}
      footer={<Button onClick={onClose}>{t('close')}</Button>}
    >
      {candidates.length === 0 ? (
        <p className={styles.empty}>{t('noneAddable')}</p>
      ) : (
        <ul className={styles.list}>
          {candidates.map((agent) => (
            <Candidate key={agent.id} agent={agent} channelId={channel.id} />
          ))}
        </ul>
      )}
    </Dialog>
  );
}

function Candidate({ agent, channelId }: { agent: Agent; channelId: string }) {
  const [busy, setBusy] = useState(false);
  const add = () => {
    setBusy(true);
    void addChannelMember(channelId, agent.id)
      .catch(reportError)
      .finally(() => setBusy(false));
  };
  return (
    <li className={styles.row}>
      <Avatar avatar={agent.avatar} name={agent.name} color={agent.color} size="row" />
      <span className={styles.name}>{agent.name}</span>
      <PrimaryTagBadge tags={agent.tags} />
      <Button size="sm" onClick={add} disabled={busy} aria-label={t('addAgent', { name: agent.name })}>
        {t('add')}
      </Button>
    </li>
  );
}
