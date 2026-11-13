import { useId, useState } from 'react';
import type { FormEvent } from 'react';
import { SkillManager } from '@/features/skills';
import { Dialog, FormAlert } from '@/shared/ui';
import type { Channel } from '@/shared/types/domain';
import { tEditor } from '../i18n/editor';
import { useAgentDraft } from '../hooks/useAgentDraft';
import { useAgentSave } from '../hooks/useAgentSave';
import { useEditorTarget } from '../hooks/useAgents';
import { closeAgentEditor } from '../store';
import type { EditorTarget } from '../store';
import { AgentPreview } from './editor/AgentPreview';
import { AgentEditorPanels } from './editor/AgentEditorPanels';
import { editorErrorsByTab } from './editor/AgentEditorPanels';
import { AgentEditorPanel, AgentEditorTabs } from './editor/AgentEditorTabs';
import type { EditorTab } from './editor/AgentEditorTabs';
import { EditorFooter } from './editor/EditorFooter';
import styles from './AgentEditorDialog.module.css';

type ChannelChoiceSource = ReadonlyArray<Pick<Channel, 'id' | 'name' | 'memberIds'>>;

export interface AgentEditorDialogProps {
  /** 自発活動の投稿先の候補（チャンネルは channels feature が持つので、組み立て役から渡す） */
  channels: ChannelChoiceSource;
  /** スキルライブラリが未設定のとき、設定の「スキルのフォルダ」を開く（設定は settings feature が持つ） */
  onOpenSkillLibrarySettings: () => void;
}

/** エージェントの作成・編集ダイアログ。対象は agents のストア（openAgentCreator / openAgentEditor）で決まる */
export function AgentEditorDialog({ channels, onOpenSkillLibrarySettings }: AgentEditorDialogProps) {
  const target = useEditorTarget();
  if (!target) return null;
  const key = target.mode === 'edit' ? target.agentId : `new-${target.templateId ?? ''}-${target.headTag ?? ''}`;
  return (
    <AgentEditor
      key={key}
      target={target}
      channels={channels}
      onOpenSkillLibrarySettings={onOpenSkillLibrarySettings}
    />
  );
}

function AgentEditor({
  target,
  channels,
  onOpenSkillLibrarySettings,
}: AgentEditorDialogProps & { target: EditorTarget }) {
  const state = useAgentDraft(target);
  const { agent, draft } = state;
  const save = useAgentSave(agent, draft);
  const formId = useId();
  const tabsId = useId();
  const [submitAttempt, setSubmitAttempt] = useState(0);
  const [selection, setSelection] = useState<{ tab: EditorTab; submitAttempt: number }>({
    tab: 'basics',
    submitAttempt: 0,
  });
  const errorTabs = editorErrorsByTab(save.errors, save.optionErrors);
  const firstErrorTab = errorTabs[0];
  if (selection.submitAttempt !== submitAttempt && firstErrorTab) {
    setSelection({ tab: firstErrorTab, submitAttempt });
  }
  const selected = selection.submitAttempt === submitAttempt ? selection.tab : (firstErrorTab ?? selection.tab);
  return (
    <Dialog
      size="lg"
      title={agent ? tEditor('editTitle', { name: agent.name }) : tEditor('newTitle')}
      description={agent ? undefined : tEditor('newDescription')}
      onClose={closeAgentEditor}
      footer={<EditorFooter agent={agent} formId={formId} saving={save.saving} />}
    >
      <div className={styles.layout}>
        <AgentPreview draft={draft} />
        <div className={styles.main}>
          <AgentEditorTabs
            id={tabsId}
            errorTabs={errorTabs}
            showSkills={agent !== null}
            tabsLabel={agent?.name ?? tEditor('newTitle')}
            selected={selected}
            onSelect={(tab) => setSelection({ tab, submitAttempt })}
          />
          <form
            id={formId}
            className={styles.form}
            onSubmit={(event: FormEvent<HTMLFormElement>) => {
              setSubmitAttempt((attempt) => attempt + 1);
              save.onSubmit(event);
            }}
            noValidate
          >
            {save.formError && <FormAlert>{save.formError}</FormAlert>}
            <AgentEditorPanels state={state} save={save} channels={channels} selected={selected} id={tabsId} />
          </form>
          {agent && (
            <AgentEditorPanel id={tabsId} tab="skills" selected={selected}>
              <SkillManager
                agentId={agent.id}
                defaultOpen={agent.consultable}
                onOpenLibrarySettings={onOpenSkillLibrarySettings}
              />
            </AgentEditorPanel>
          )}
        </div>
      </div>
    </Dialog>
  );
}
