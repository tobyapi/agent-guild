import { RadioGroup, SwitchField } from '@/shared/ui';
import type { RadioOption } from '@/shared/ui';
import type { UnmentionedPolicy } from '@/shared/types/domain';
import { tEditor } from '../../i18n/editor';
import type { AgentDraft, DraftUpdate } from '../../model/draft';
import { EditorSection } from './EditorSection';

export interface BehaviorFieldsProps {
  draft: AgentDraft;
  update: DraftUpdate;
}

/** メンションのない発言への振る舞い（docs/ui-design.md §6.3 の表。上の段に該当者がいれば下の段は答えない） */
function unmentionedOptions(): ReadonlyArray<RadioOption<UnmentionedPolicy>> {
  return [
    { value: 'lead', label: tEditor('leadLabel'), description: tEditor('leadDescription') },
    { value: 'answer', label: tEditor('answerLabel'), description: tEditor('answerDescription') },
    { value: 'fallback', label: tEditor('fallbackLabel'), description: tEditor('fallbackDescription') },
    { value: 'ignore', label: tEditor('ignoreLabel'), description: tEditor('ignoreDescription') },
  ];
}

/** 振る舞い: メンションのない発言への反応・相談相手になるか・タスクを割り振れるか（docs/design.md §7・§7.1） */
export function BehaviorFields({ draft, update }: BehaviorFieldsProps) {
  return (
    <EditorSection title={tEditor('behaviorSection')}>
      <RadioGroup
        legend={tEditor('unmentionedLegend')}
        value={draft.unmentioned}
        options={unmentionedOptions()}
        onChange={(value) => update('unmentioned', value)}
        columns={2}
      />
      <SwitchField
        label={tEditor('consultableLabel')}
        hint={tEditor('consultableHint')}
        checked={draft.consultable}
        onChange={(on) => update('consultable', on)}
      />
      <SwitchField
        label={tEditor('canDelegateLabel')}
        hint={tEditor('canDelegateHint')}
        checked={draft.canDelegate}
        onChange={(on) => update('canDelegate', on)}
      />
    </EditorSection>
  );
}
