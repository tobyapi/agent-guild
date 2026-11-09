// エージェントとテンプレートを読むフック。配列を新しく作るものは useShallow で再描画を抑える。
import { useShallow } from 'zustand/react/shallow';
import type { Agent, AgentTemplate, TemplateAccent } from '@/shared/types/domain';
import { tagAccent } from '../model/accent';
import { useAgentsStore } from '../store';
import type { EditorTarget } from '../store';

/** 削除済みも含む全員（過去の発言の作者表示に使う） */
export function useAllAgents(): Agent[] {
  return useAgentsStore((state) => state.agents);
}

/** 削除されていないエージェント（作成順） */
export function useActiveAgents(): Agent[] {
  return useAgentsStore(useShallow((state) => state.agents.filter((agent) => agent.deletedAt === null)));
}

/** エージェント作成のテンプレート（Snapshot.templates の順） */
export function useTemplates(): AgentTemplate[] {
  return useAgentsStore((state) => state.templates);
}

/** タグの色（そのタグを先頭に持つテンプレートの accent。なければ null = 中立） */
export function useTagAccent(tag: string | null): TemplateAccent {
  return useAgentsStore((state) => tagAccent(state.templates, tag));
}

export function useEditorTarget(): EditorTarget | null {
  return useAgentsStore((state) => state.editor);
}
