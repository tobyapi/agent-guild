// agents: エージェントとテンプレート、先頭のタグによる区分と色、作成・編集ダイアログ。
export { AccentMark } from './components/AccentMark';
export { AgentEditorDialog } from './components/AgentEditorDialog';
export { AgentSections } from './components/AgentSections';
export { PrimaryTagBadge, TagBadge } from './components/TagBadge';
export { useActiveAgents, useAllAgents, useTemplates } from './hooks/useAgents';
export { agentAccent, HUMAN_ACCENT, primaryTag } from './model/accent';
export type { MemberAccent } from './model/accent';
export { groupByPrimaryTag } from './model/groups';
export type { TagGroup } from './model/groups';
export { applyAgentsSnapshot, openAgentEditor } from './store';
