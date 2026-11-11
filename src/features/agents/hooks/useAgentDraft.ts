import { useCallback, useMemo, useState } from 'react';
import { useBackends } from '@/features/runtime';
import { permissionRole, rolePermissions, modelPermissions } from '@/shared/lib/permissionPolicy';
import type { Agent, AgentTemplate } from '@/shared/types/domain';
import {
  applyPreset,
  applyTemplate,
  changeBackend,
  changeModel,
  changeRole,
  draftFromAgent,
  newDraft,
  putHeadTag,
} from '../model/draft';
import type { AgentDraft, DraftUpdate } from '../model/draft';
import type { AgentPreset } from '../model/presets';
import type { EditorTarget } from '../store';
import { useAllAgents, useTemplates } from './useAgents';

/** 権限は入力状態にかかわらず、役割と現在のバックエンドから求める。保存済みの個別設定も引き継がない。 */
export function useAgentDraft(target: EditorTarget) {
  const agents = useAllAgents();
  const backends = useBackends();
  const templates = useTemplates();
  const agent: Agent | null =
    target.mode === 'edit' ? (agents.find((candidate) => candidate.id === target.agentId) ?? null) : null;
  const [values, setDraft] = useState<AgentDraft>(() => {
    if (agent) return draftFromAgent(agent, backends);
    const template = templates.find((candidate) => target.mode === 'create' && candidate.id === target.templateId);
    const created = newDraft(
      template ?? (target.mode === 'create' && !target.headTag ? templates[0] : undefined),
      backends,
      agents.length,
    );
    return target.mode === 'create' && target.headTag ? putHeadTag(created, target.headTag) : created;
  });
  const [edited, setEdited] = useState(false);
  const [replaced, setReplaced] = useState(false);
  const [backendEdited, setBackendEdited] = useState(false);
  const change = useCallback((next: (current: AgentDraft) => AgentDraft) => {
    setEdited(true);
    setDraft(next);
  }, []);
  const update: DraftUpdate = useCallback(
    (key, value) => {
      if (key === 'effort' || key === 'optionValues') setBackendEdited(true);
      change((current) => ({ ...current, [key]: value }));
    },
    [change],
  );
  const templateId = permissionRole(templates, values.tags)?.id ?? null;
  const chooseTemplate = (template: AgentTemplate) => {
    setReplaced(!agent && edited && template.id !== templateId);
    setEdited(false);
    setDraft((current) =>
      agent
        ? changeRole(current, template, templates)
        : applyTemplate(current, template, backendEdited ? [] : backends),
    );
  };
  const choosePreset = (preset: AgentPreset) => change((current) => applyPreset(current, preset));
  const setBackend = (backend: string) => {
    setBackendEdited(true);
    change((current) => changeBackend(current, backend));
  };
  const setModel = (model: string) => {
    setBackendEdited(true);
    change((current) =>
      changeModel(
        current,
        model,
        backends.find((backend) => backend.id === current.backend),
      ),
    );
  };
  const backend = backends.find((candidate) => candidate.id === values.backend);
  const draft = useMemo(
    () => ({
      ...values,
      permissions: modelPermissions(
        rolePermissions(templates, values.tags),
        backend,
        values.model,
        values.optionValues,
        values.backend,
      ),
    }),
    [values, templates, backend],
  );
  return { agent, draft, templateId, replaced, update, setBackend, setModel, chooseTemplate, choosePreset };
}
