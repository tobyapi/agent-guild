import { useState } from 'react';
import { Button, Icon, notifyInfo, reportError, SelectField, SwitchField, TextField } from '@/shared/ui';
import type { Agent, Channel } from '@/shared/types/domain';
import { AUTONOMY_INTERVAL_MIN } from '@/shared/lib/limits';
import { autonomyChannelChoices, parseIntervalMin } from '../../model/autonomy';
import { runAutonomous } from '../../store';
import { EditorSection } from './EditorSection';
import type { SectionProps } from './EditorSection';
import styles from './Editor.module.css';

export interface AutonomyFieldsProps extends SectionProps {
  /** 保存済みのエージェント（新規作成中は null） */
  agent: Agent | null;
  channels: ReadonlyArray<Pick<Channel, 'id' | 'name' | 'memberIds'>>;
}

/** 自発活動: 有効化・間隔・投稿先・今すぐ動いてもらう */
export function AutonomyFields({ agent, channels, draft, update, errors, touch }: AutonomyFieldsProps) {
  const choices = autonomyChannelChoices(channels, agent?.id ?? null);
  const minutes = parseIntervalMin(draft.autonomyIntervalMin) ?? AUTONOMY_INTERVAL_MIN;
  return (
    <EditorSection title="自発活動">
      <SwitchField
        label="自分から動く"
        hint={`${minutes} 分ごとに、自分から調べものや提案をします。`}
        checked={draft.autonomyEnabled}
        onChange={(on) => update('autonomyEnabled', on)}
      />
      <div className={styles.row}>
        <TextField
          label="間隔（分）"
          value={draft.autonomyIntervalMin}
          onChange={(value) => update('autonomyIntervalMin', value)}
          onBlur={() => touch('autonomyIntervalMin')}
          error={errors.autonomyIntervalMin}
          type="number"
          min={AUTONOMY_INTERVAL_MIN}
          numeric
        />
        <SelectField
          label="投稿先"
          value={draft.autonomyChannelId ?? ''}
          onChange={(value) => update('autonomyChannelId', value === '' ? null : value)}
          hint={choices.length === 0 ? 'チャンネルに参加すると選べます。' : undefined}
        >
          <option value="">参加している最初のチャンネル</option>
          {choices.map((choice) => (
            <option key={choice.id} value={choice.id}>
              #{choice.name}
            </option>
          ))}
        </SelectField>
      </div>
      {agent && <RunNowButton agent={agent} />}
    </EditorSection>
  );
}

function RunNowButton({ agent }: { agent: Agent }) {
  const [busy, setBusy] = useState(false);
  const run = () => {
    setBusy(true);
    void runAutonomous(agent.id)
      .then(() => notifyInfo(`${agent.name} が動き始めます`), reportError)
      .finally(() => setBusy(false));
  };
  return (
    <Button size="sm" className={styles.inlineAction} onClick={run} disabled={busy}>
      <Icon name="play" />
      今すぐ動いてもらう
    </Button>
  );
}
