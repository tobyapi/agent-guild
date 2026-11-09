// エージェントとテンプレート（Snapshot.agents / templates）と、編集ダイアログの対象。
import { create } from 'zustand';
import type { Agent, AgentInput, AgentTemplate } from '@/shared/types/domain';
import { agentsApi } from './api';

/** 作成はテンプレートを選んだ状態で始める（null は白紙）。headTag はサイドバーの区画の「＋」から来たとき先頭に入れるタグ */
export type EditorTarget = { mode: 'create'; templateId: string | null; headTag: string | null } | { mode: 'edit'; agentId: string };

interface AgentsStoreState {
  /** 削除済み（deletedAt あり）も含む。過去の発言の作者表示に使う */
  agents: Agent[];
  templates: AgentTemplate[];
  editor: EditorTarget | null;
}

export const useAgentsStore = create<AgentsStoreState>()(() => ({ agents: [], templates: [], editor: null }));

function isEditable(editor: EditorTarget | null, agents: readonly Agent[]): boolean {
  if (editor?.mode !== 'edit') return true;
  return agents.some((agent) => agent.id === editor.agentId && agent.deletedAt === null);
}

/** スナップショットを反映する。編集中のエージェントが消えていたらダイアログを閉じる */
export function applyAgentsSnapshot(agents: Agent[], templates: AgentTemplate[]): void {
  useAgentsStore.setState((state) => ({ agents, templates, editor: isEditable(state.editor, agents) ? state.editor : null }));
}

export function openAgentCreator(templateId: string | null, headTag: string | null = null): void {
  useAgentsStore.setState({ editor: { mode: 'create', templateId, headTag } });
}

export function openAgentEditor(agentId: string): void {
  useAgentsStore.setState({ editor: { mode: 'edit', agentId } });
}

export function closeAgentEditor(): void {
  useAgentsStore.setState({ editor: null });
}

function upsert(agent: Agent): void {
  useAgentsStore.setState((state) => ({
    agents: state.agents.some((candidate) => candidate.id === agent.id)
      ? state.agents.map((candidate) => (candidate.id === agent.id ? agent : candidate))
      : [...state.agents, agent],
  }));
}

export async function createAgent(input: AgentInput): Promise<Agent> {
  const agent = await agentsApi.create(input);
  upsert(agent);
  return agent;
}

export async function updateAgent(id: string, input: AgentInput): Promise<Agent> {
  const agent = await agentsApi.update(id, input);
  upsert(agent);
  return agent;
}

/** 論理削除。一覧からはすぐに消し、確かな値は state-changed のスナップショットで届く */
export async function deleteAgent(id: string): Promise<void> {
  await agentsApi.remove(id);
  useAgentsStore.setState((state) => ({
    agents: state.agents.map((agent) => (agent.id === id ? { ...agent, deletedAt: Date.now() } : agent)),
    editor: null,
  }));
}

export async function runAutonomous(agentId: string): Promise<void> {
  await agentsApi.runAutonomous(agentId);
}

export async function openAgentWorkspace(agentId: string): Promise<void> {
  await agentsApi.openWorkspace(agentId);
}
