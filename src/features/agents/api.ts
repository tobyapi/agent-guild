import { invoke } from '@/shared/api';
import type { AgentInput } from '@/shared/types/domain';

export const agentsApi = {
  create: (input: AgentInput) => invoke('create_agent', { input }),
  update: (id: string, input: AgentInput) => invoke('update_agent', { id, input }),
  remove: (id: string) => invoke('delete_agent', { id }),
  runAutonomous: (agentId: string) => invoke('run_autonomous', { agentId }),
  openWorkspace: (agentId: string) => invoke('open_agent_workspace', { agentId }),
  openUrl: (url: string) => invoke('open_url', { url }),
};
