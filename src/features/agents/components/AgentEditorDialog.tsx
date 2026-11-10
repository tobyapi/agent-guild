import { useId } from 'react';
import { SkillManager } from '@/features/skills';
import { Dialog, FormAlert } from '@/shared/ui';
import type { Channel } from '@/shared/types/domain';
import { useAgentDraft } from '../hooks/useAgentDraft';
import { useAgentSave } from '../hooks/useAgentSave';
import { useEditorTarget } from '../hooks/useAgents';
import { closeAgentEditor } from '../store';
import type { EditorTarget } from '../store';
import { AgentPreview } from './editor/AgentPreview';
import { AutonomyFields } from './editor/AutonomyFields';
import { BasicsFields } from './editor/BasicsFields';
import { BehaviorFields } from './editor/BehaviorFields';
import { BrainFields } from './editor/BrainFields';
import { EditorFooter } from './editor/EditorFooter';
import { PermissionFields } from './editor/PermissionFields';
import { PersonaFields } from './editor/PersonaFields';
import { TemplatePicker } from './editor/TemplatePicker';
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
  const { agent, draft, templateId, replaced, update, setBackend, setModel, chooseTemplate, choosePreset } =
    useAgentDraft(target);
  const save = useAgentSave(agent, draft);
  const formId = useId();
  const sectionProps = { draft, update, errors: save.errors, touch: save.touch };
  return (
    <Dialog
      size="lg"
      title={agent ? `${agent.name} を編集` : '新しいエージェント'}
      description={agent ? undefined : 'ギルドに新しい仲間を迎えます。あとからいつでも変えられます。'}
      onClose={closeAgentEditor}
      footer={<EditorFooter agent={agent} formId={formId} saving={save.saving} />}
    >
      <div className={styles.layout}>
        <AgentPreview draft={draft} />
        <div className={styles.main}>
          <form id={formId} className={styles.form} onSubmit={save.onSubmit} noValidate>
            {save.formError && <FormAlert>{save.formError}</FormAlert>}
            <TemplatePicker
              templateId={templateId}
              replaced={replaced}
              onTemplate={chooseTemplate}
              onPreset={choosePreset}
              editing={agent !== null}
            />
            <BasicsFields {...sectionProps} />
            <PersonaFields draft={draft} update={update} />
            <BehaviorFields draft={draft} update={update} />
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
              permissions={draft.permissions}
              tags={draft.tags}
              error={save.errors.permissions}
            />
            <AutonomyFields agent={agent} channels={channels} {...sectionProps} />
          </form>
          {/* 相談相手になる人は知識（スキル）が要なので、スキルの区画を開いておく */}
          {agent && (
            <SkillManager
              agentId={agent.id}
              defaultOpen={agent.consultable}
              onOpenLibrarySettings={onOpenSkillLibrarySettings}
            />
          )}
        </div>
      </div>
    </Dialog>
  );
}
