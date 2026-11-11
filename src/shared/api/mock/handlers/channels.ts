// チャンネルの作成・更新・削除とメンバーの出入り。
import { CHANNEL_NAME_MAX, CHANNEL_TOPIC_MAX, cleanChannelName } from '@/shared/lib/limits';
import { checkText } from '@/shared/lib/validation';
import { HUMAN_ID } from '@/shared/types/domain';
import type { Channel } from '@/shared/types/domain';
import { activeAgents, emitStateChanged, fail, joinChannel, requireAgent, requireChannel } from '../runtime';
import type { HandlerGroup } from './types';

type ChannelCommands =
  | 'create_channel'
  | 'get_channel_statistics'
  | 'update_channel'
  | 'set_channel_workspace'
  | 'delete_channel'
  | 'add_channel_member'
  | 'remove_channel_member';

/** 名前（先頭の # は除く）と話題を検証して整える */
function cleanFields(name: string, topic: string): Pick<Channel, 'name' | 'topic'> {
  const cleanName = cleanChannelName(name);
  const nameProblem = checkText(cleanName, { label: 'チャンネル名', required: true, max: CHANNEL_NAME_MAX });
  if (nameProblem !== null) fail('validation', nameProblem, 'name');
  const topicProblem = checkText(topic, { label: '話題', max: CHANNEL_TOPIC_MAX });
  if (topicProblem !== null) fail('validation', topicProblem, 'topic');
  return { name: cleanName, topic: topic.trim() };
}

export const channelHandlers: HandlerGroup<ChannelCommands> = {
  get_channel_statistics({ channelId }, runtime) {
    requireChannel(runtime, channelId);
    const delegations = runtime.state.delegations.filter((delegation) => delegation.channelId === channelId);
    const subtasks = delegations.flatMap((delegation) => delegation.subtasks);
    return {
      delegation: {
        delegations: delegations.length,
        subtasks: subtasks.length,
        reported: subtasks.filter((task) => task.status === 'done' && task.resultMessageId !== null).length,
        failed: subtasks.filter((task) => task.status === 'failed').length,
        cancelled: subtasks.filter((task) => task.status === 'cancelled').length,
        pending: subtasks.filter((task) => task.status === 'pending' || task.status === 'running').length,
      },
      models: [],
    };
  },

  create_channel({ name, topic, memberIds }, runtime) {
    const agentIds = activeAgents(runtime)
      .map((agent) => agent.id)
      .filter((id) => memberIds.includes(id));
    const channel: Channel = {
      id: runtime.env.newId(),
      isLobby: false,
      ...cleanFields(name, topic),
      memberIds: [HUMAN_ID, ...agentIds],
      createdAt: runtime.env.now(),
    };
    runtime.state.channels.push(channel);
    emitStateChanged(runtime);
    return channel;
  },

  update_channel({ id, name, topic }, runtime) {
    const channel = requireChannel(runtime, id);
    Object.assign(channel, cleanFields(name, topic));
    emitStateChanged(runtime);
    return channel;
  },

  set_channel_workspace({ id, mode, folder }, runtime) {
    const channel = requireChannel(runtime, id);
    if (!['legacy', 'folder', 'global'].includes(mode)) fail('validation', '作業範囲を選んでください');
    if (mode === 'folder' && (!folder?.trim() || !/^(?:\/|[A-Za-z]:[\\/])/.test(folder)))
      fail('validation', '作業フォルダの絶対パスを入力してください');
    if (mode !== 'folder' && folder !== null) fail('validation', 'フォルダモード以外では割り当てを空にしてください');
    channel.workspace = {
      mode,
      folder,
      revision: (channel.workspace?.revision ?? 0) + 1,
      afterSeq: Math.max(0, ...runtime.state.messages.filter((m) => m.channelId === id).map((m) => m.seq)),
    };
    emitStateChanged(runtime);
    return channel;
  },

  delete_channel({ id }, runtime) {
    requireChannel(runtime, id);
    runtime.conversation.dropChannel(id);
    runtime.state.channels = runtime.state.channels.filter((channel) => channel.id !== id);
    runtime.state.messages = runtime.state.messages.filter((message) => message.channelId !== id);
    emitStateChanged(runtime);
    return null;
  },

  add_channel_member({ channelId, memberId }, runtime) {
    const channel = requireChannel(runtime, channelId);
    const agent = requireAgent(runtime, memberId);
    if (!channel.memberIds.includes(agent.id)) {
      joinChannel(runtime, channel, agent);
      emitStateChanged(runtime);
    }
    return null;
  },

  remove_channel_member({ channelId, memberId }, runtime) {
    const channel = requireChannel(runtime, channelId);
    if (memberId === HUMAN_ID) fail('validation', 'あなた自身はチャンネルから外せません');
    if (!channel.memberIds.includes(memberId)) fail('not_found', 'このチャンネルのメンバーではありません');
    runtime.conversation.dropMember(channelId, memberId);
    channel.memberIds = channel.memberIds.filter((id) => id !== memberId);
    emitStateChanged(runtime);
    return null;
  },
};
