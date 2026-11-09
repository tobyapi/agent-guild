import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { useProfile } from '@/features/profile';
import { useBackends } from '@/features/runtime';
import { errorCode, errorField, errorMessage } from '@/shared/lib/errors';
import { notifyInfo, reportError, useFieldErrors } from '@/shared/ui';
import type { Agent, AgentInput } from '@/shared/types/domain';
import type { AgentDraft } from '../model/draft';
import { agentErrorField, validateAgentDraft } from '../model/validation';
import type { AgentField } from '../model/validation';
import { closeAgentEditor, createAgent, openAgentEditor, updateAgent } from '../store';
import { useAllAgents } from './useAgents';

interface ServerError {
  field: AgentField | null;
  message: string;
  /** エラーが出たときの入力。入力を変えたら消す（同じ参照のあいだだけ見せる） */
  draft: AgentDraft;
}

async function persist(agent: Agent | null, input: AgentInput): Promise<void> {
  if (agent) {
    await updateAgent(agent.id, input);
    notifyInfo('保存しました');
    closeAgentEditor();
    return;
  }
  const created = await createAgent(input);
  notifyInfo(`${created.name} を迎えました`);
  // 作成したら、スキルを足せるように編集画面へ切り替える
  openAgentEditor(created.id);
}

/** 最初のエラーの入力にフォーカスを移す（エラーを描いたあとに） */
function focusFirstError(form: HTMLFormElement): void {
  setTimeout(() => form.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(), 0);
}

/** 検証と保存（docs/ui-design.md §5.10 の 2 段構えのエラー表示） */
export function useAgentSave(agent: Agent | null, draft: AgentDraft) {
  const agents = useAllAgents();
  const backends = useBackends();
  const me = useProfile();
  const [serverError, setServerError] = useState<ServerError | null>(null);
  const [saving, setSaving] = useState(false);
  const takenNames = useMemo(
    () => [
      ...agents.filter((other) => other.deletedAt === null && other.id !== agent?.id).map((other) => other.name),
      me.name,
    ],
    [agents, agent, me.name],
  );
  const result = validateAgentDraft(draft, { backends, takenNames });
  const { visible, touch, markSubmitted } = useFieldErrors<AgentField>(result.ok ? {} : result.errors);

  const save = async (form: HTMLFormElement) => {
    markSubmitted();
    if (!result.ok) return focusFirstError(form);
    setSaving(true);
    try {
      await persist(agent, result.input);
    } catch (error) {
      const code = errorCode(error);
      if (code !== 'validation' && code !== 'conflict') return reportError(error);
      setServerError({ field: agentErrorField(code, errorField(error)), message: errorMessage(error), draft });
      focusFirstError(form);
    } finally {
      setSaving(false);
    }
  };

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void save(event.currentTarget);
  };

  const current = serverError?.draft === draft ? serverError : null;
  const errors = current?.field ? { ...visible, [current.field]: current.message } : visible;
  const optionErrors = result.ok ? {} : result.optionErrors;
  return { errors, optionErrors, formError: current?.field === null ? current.message : null, saving, touch, onSubmit };
}
