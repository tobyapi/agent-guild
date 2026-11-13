import type { Channel } from '@/shared/types/domain';
import { useAgentDraft } from '../../hooks/useAgentDraft';
import { useAgentSave } from '../../hooks/useAgentSave';
import { AgentEditorPanel } from './AgentEditorTabs';
import type { EditorTab } from './AgentEditorTabs';
import { AutonomyFields } from './AutonomyFields';
import { BasicsFields } from './BasicsFields';
import { BehaviorFields } from './BehaviorFields';
import { BrainFields } from './BrainFields';
import { PermissionFields } from './PermissionFields';
import { PersonaFields } from './PersonaFields';
import { TemplatePicker } from './TemplatePicker';

type Channels = ReadonlyArray<Pick<Channel, 'id' | 'name' | 'memberIds'>>;

export function AgentEditorPanels({
  state,
  save,
  channels,
  selected,
  id,
}: {
  state: ReturnType<typeof useAgentDraft>;
  save: ReturnType<typeof useAgentSave>;
  channels: Channels;
  selected: EditorTab;
  id: string;
}) {
  const { agent, draft, templateId, replaced, update, setBackend, setModel, chooseTemplate, choosePreset } = state;
  const sectionProps = { draft, update, errors: save.errors, touch: save.touch };
  return (
    <>
      <AgentEditorPanel id={id} tab="basics" selected={selected}>
        <TemplatePicker
          templateId={templateId}
          replaced={replaced}
          onTemplate={chooseTemplate}
          onPreset={choosePreset}
          editing={agent !== null}
        />
        <BasicsFields {...sectionProps} />
      </AgentEditorPanel>
      <AgentEditorPanel id={id} tab="persona" selected={selected}>
        <PersonaFields draft={draft} update={update} />
      </AgentEditorPanel>
      <AgentEditorPanel id={id} tab="behavior" selected={selected}>
        <BehaviorFields draft={draft} update={update} />
        <AutonomyFields agent={agent} channels={channels} {...sectionProps} />
      </AgentEditorPanel>
      <AgentEditorPanel id={id} tab="brain" selected={selected}>
        <BrainFields
          draft={draft}
          errors={save.errors}
          optionErrors={save.optionErrors}
          update={update}
          onBackend={setBackend}
          onModel={setModel}
        />
        <PermissionFields
          backendId={draft.backend}
          model={draft.model}
          options={draft.optionValues}
          permissions={draft.permissions}
          tags={draft.tags}
          error={save.errors.permissions}
        />
      </AgentEditorPanel>
    </>
  );
}

export function editorErrorsByTab(
  errors: ReturnType<typeof useAgentSave>['errors'],
  optionErrors: Record<string, string>,
): EditorTab[] {
  const tabs: EditorTab[] = [];
  if (errors.name || errors.avatar || errors.color || errors.tags) tabs.push('basics');
  if (errors.autonomyIntervalMin) tabs.push('behavior');
  if (errors.backend || errors.effort || errors.permissions || Object.keys(optionErrors).length > 0) tabs.push('brain');
  return tabs;
}
