import { RadioGroup, SwitchField } from '@/shared/ui';
import type { RadioOption } from '@/shared/ui';
import type { UnmentionedPolicy } from '@/shared/types/domain';
import type { AgentDraft, DraftUpdate } from '../../model/draft';
import { EditorSection } from './EditorSection';

export interface BehaviorFieldsProps {
  draft: AgentDraft;
  update: DraftUpdate;
}

/** メンションのない発言への振る舞い（docs/ui-design.md §6.3 の表。上の段に該当者がいれば下の段は答えない） */
const UNMENTIONED_OPTIONS: ReadonlyArray<RadioOption<UnmentionedPolicy>> = [
  { value: 'lead', label: '最初に受ける', description: 'メンションのない依頼は、まず自分が受けます。いるあいだ、ほかのメンバーは答えません。' },
  { value: 'answer', label: '答える', description: 'メンションがなくても答えます。' },
  { value: 'fallback', label: '他にいなければ答える', description: '最初に受ける人も答える人もいないときだけ答えます。' },
  { value: 'ignore', label: '答えない', description: '呼ばれたときと、割り振られたときだけ話します。' },
];

/** 振る舞い: メンションのない発言への反応・相談相手になるか・タスクを割り振れるか（docs/design.md §7・§7.1） */
export function BehaviorFields({ draft, update }: BehaviorFieldsProps) {
  return (
    <EditorSection title="振る舞い">
      <RadioGroup
        legend="メンションのない発言には"
        value={draft.unmentioned}
        options={UNMENTIONED_OPTIONS}
        onChange={(value) => update('unmentioned', value)}
        columns={2}
      />
      <SwitchField
        label="相談相手になる"
        hint="ほかのエージェントに @ で呼ばれたら、チャンネルの外からでも参加して答えます。"
        checked={draft.consultable}
        onChange={(on) => update('consultable', on)}
      />
      <SwitchField
        label="タスクを割り振れる"
        hint="依頼を分けて、ほかのメンバーに割り振れます。結果がそろったら、まとめて報告します。"
        checked={draft.canDelegate}
        onChange={(on) => update('canDelegate', on)}
      />
    </EditorSection>
  );
}
