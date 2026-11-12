import { PrimaryTagBadge, useActiveAgents } from '@/features/agents';
import { Avatar, CheckboxField } from '@/shared/ui';
import { t } from '../i18n';
import styles from './ChannelDialog.module.css';

export interface MemberPickerProps {
  selected: readonly string[];
  onChange: (memberIds: string[]) => void;
}

/** チャンネル作成時のメンバー選択（あなたは必ず入る） */
export function MemberPicker({ selected, onChange }: MemberPickerProps) {
  const agents = useActiveAgents();
  const toggle = (agentId: string, on: boolean) => {
    const others = selected.filter((id) => id !== agentId);
    onChange(on ? [...others, agentId] : others);
  };
  return (
    <fieldset className={styles.members}>
      <legend className={styles.legend}>{t('members')}</legend>
      <p className={styles.help}>{t('pickerHelp')}</p>
      {agents.length === 0 && <p className={styles.help}>{t('noAgents')}</p>}
      {agents.map((agent) => (
        <CheckboxField
          key={agent.id}
          checked={selected.includes(agent.id)}
          onChange={(on) => toggle(agent.id, on)}
          label={
            <span className={styles.memberLabel}>
              <Avatar avatar={agent.avatar} name={agent.name} color={agent.color} size="xs" />
              {agent.name}
              <PrimaryTagBadge tags={agent.tags} />
            </span>
          }
        />
      ))}
    </fieldset>
  );
}
