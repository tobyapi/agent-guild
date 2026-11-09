import { useCallback, useState } from 'react';
import { useBackends } from '@/features/runtime';
import type { Agent, AgentTemplate, PermissionKey } from '@/shared/types/domain';
import {
  applyPreset,
  applyTemplate,
  changeBackend,
  changeModel,
  draftFromAgent,
  newDraft,
  putHeadTag,
  setPermission,
} from '../model/draft';
import type { AgentDraft, DraftUpdate } from '../model/draft';
import type { AgentPreset } from '../model/presets';
import type { EditorTarget } from '../store';
import { useAllAgents, useTemplates } from './useAgents';

/** 編集ダイアログの入力中の値。ダイアログは対象ごとに作り直すので、初期値は最初の描画で決める */
export function useAgentDraft(target: EditorTarget) {
  const agents = useAllAgents();
  const backends = useBackends();
  const templates = useTemplates();
  const agent: Agent | null =
    target.mode === 'edit' ? (agents.find((candidate) => candidate.id === target.agentId) ?? null) : null;
  /** 作成時に選んでいるテンプレート（編集時は null。作成後のエージェントはテンプレートと結びつかない） */
  const [templateId, setTemplateId] = useState(target.mode === 'create' ? target.templateId : null);
  const [draft, setDraft] = useState<AgentDraft>(() => {
    if (agent) return draftFromAgent(agent, backends);
    const created = newDraft(
      templates.find((template) => template.id === templateId),
      backends,
      agents.length,
    );
    return target.mode === 'create' && target.headTag ? putHeadTag(created, target.headTag) : created;
  });

  /** テンプレートを入れたあとに何か入力したか / 入力した内容を別のテンプレートの値で置き換えたか（その旨を出す） */
  const [edited, setEdited] = useState(false);
  const [replaced, setReplaced] = useState(false);
  const change = useCallback((next: (current: AgentDraft) => AgentDraft) => {
    setEdited(true);
    setDraft(next);
  }, []);

  const update: DraftUpdate = useCallback(
    (key, value) => change((current) => ({ ...current, [key]: value })),
    [change],
  );
  const setBackend = useCallback((backend: string) => change((current) => changeBackend(current, backend)), [change]);
  const setModel = useCallback(
    (model: string) =>
      change((current) =>
        changeModel(
          current,
          model,
          backends.find((b) => b.id === current.backend),
        ),
      ),
    [change, backends],
  );
  const chooseTemplate = (template: AgentTemplate) => {
    setReplaced(edited && template.id !== templateId);
    setEdited(false);
    setTemplateId(template.id);
    setDraft((current) => applyTemplate(current, template));
  };
  const choosePreset = useCallback(
    (preset: AgentPreset) => change((current) => applyPreset(current, preset)),
    [change],
  );
  const togglePermission = useCallback(
    (key: PermissionKey, on: boolean) => change((current) => setPermission(current, key, on)),
    [change],
  );

  return {
    agent,
    draft,
    templateId,
    replaced,
    update,
    setBackend,
    setModel,
    chooseTemplate,
    choosePreset,
    togglePermission,
  };
}
