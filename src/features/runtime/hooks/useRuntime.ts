// 実行環境の状態を読むフック。配列を新しく作るものは useShallow で再描画を抑える。
import { useShallow } from 'zustand/react/shallow';
import type { AgentActivity, BackendInfo, ChannelQueue, RuntimeStatus } from '@/shared/types/domain';
import { useRuntimeStore } from '../store';

export function useRuntimeStatus(): RuntimeStatus {
  return useRuntimeStore((state) => state.runtime);
}

export function useBackends(): BackendInfo[] {
  return useRuntimeStore((state) => state.backends);
}

export function useBackend(backendId: string): BackendInfo | undefined {
  return useRuntimeStore((state) => state.backends.find((backend) => backend.id === backendId));
}

export function useCheckingBackends(): boolean {
  return useRuntimeStore((state) => state.checkingBackends || state.startingOllama);
}

export function useStartingOllama(): boolean {
  return useRuntimeStore((state) => state.startingOllama);
}

/** ログイン中のバックエンドの ID（なければ null） */
export function useLoggingIn(): string | null {
  return useRuntimeStore((state) => state.loggingIn);
}

/** ギルドのどこかで誰かが動いているか（紋の灯） */
export function useAnyoneWorking(): boolean {
  return useRuntimeStore((state) => state.activity.activities.length > 0);
}

export function useChannelActivities(channelId: string): AgentActivity[] {
  return useRuntimeStore(
    useShallow((state) => state.activity.activities.filter((item) => item.channelId === channelId)),
  );
}

export function useChannelQueue(channelId: string): ChannelQueue | undefined {
  return useRuntimeStore((state) => state.activity.queues.find((queue) => queue.channelId === channelId));
}

export function useAgentActivity(agentId: string): AgentActivity | undefined {
  return useRuntimeStore((state) => state.activity.activities.find((item) => item.agentId === agentId));
}
