// エージェントの作成・更新・削除（論理削除）・自発活動・作業フォルダ。
import { permissionRole } from '@/shared/lib/permissionPolicy';
import { addRoleSkills } from '../defaultSkills';
import type { Agent, Channel } from '@/shared/types/domain';
import { emitStateChanged, fail, joinChannel, requireAgent } from '../runtime';
import type { MockCore } from '../runtime';
import { validateAgentInput } from './agentInput';
import type { HandlerGroup } from './types';

type AgentCommands = 'create_agent' | 'update_agent' | 'delete_agent' | 'run_autonomous' | 'open_agent_workspace';

/** 自発活動の投稿先: 指定のチャンネル（メンバーなら）→ 参加している最初のチャンネル（design.md §10） */
function autonomyChannel(core: MockCore, agent: Agent): Channel | undefined {
  const joined = core.state.channels.filter((channel) => channel.memberIds.includes(agent.id));
  return joined.find((channel) => channel.id === agent.autonomyChannelId) ?? joined[0];
}

export const agentHandlers: HandlerGroup<AgentCommands> = {
  create_agent({ input }, runtime) {
    const agent: Agent = {
      ...validateAgentInput(runtime, input, null),
      id: runtime.env.newId(),
      lastAutonomousAt: null,
      createdAt: runtime.env.now(),
      deletedAt: null,
    };
    runtime.state.agents.push(agent);
    addRoleSkills(runtime, agent);
    // 表示名に依存せず、保存されたロビーフラグで探す。
    const lobby = runtime.state.channels.find((channel) => channel.isLobby);
    if (lobby && !lobby.memberIds.includes(agent.id)) joinChannel(runtime, lobby, agent);
    emitStateChanged(runtime);
    return agent;
  },

  update_agent({ id, input }, runtime) {
    const agent = requireAgent(runtime, id);
    const oldRole = permissionRole(runtime.state.templates, agent.tags);
    Object.assign(agent, validateAgentInput(runtime, input, id));
    if (oldRole !== permissionRole(runtime.state.templates, agent.tags)) addRoleSkills(runtime, agent);
    emitStateChanged(runtime);
    return agent;
  },

  delete_agent({ id }, runtime) {
    const agent = requireAgent(runtime, id);
    runtime.conversation.dropAgent(id);
    agent.deletedAt = runtime.env.now();
    runtime.state.skills = runtime.state.skills.filter((skill) => skill.agentId !== id);
    for (const channel of runtime.state.channels) {
      channel.memberIds = channel.memberIds.filter((memberId) => memberId !== id);
    }
    emitStateChanged(runtime);
    return null;
  },

  run_autonomous({ agentId }, runtime) {
    const agent = requireAgent(runtime, agentId);
    const channel =
      autonomyChannel(runtime, agent) ?? fail('validation', `${agent.name} はどのチャンネルにも参加していません`);
    agent.lastAutonomousAt = runtime.env.now();
    runtime.conversation.queueAutonomous(agent.id, channel.id);
    return null;
  },

  open_agent_workspace({ agentId }, runtime) {
    requireAgent(runtime, agentId);
    return null;
  },
};
