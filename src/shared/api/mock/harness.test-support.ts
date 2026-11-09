// モックのテスト用の組み立て（偽のタイマーと決まった ID で動かし、届いたイベントを記録する）。
import { vi } from 'vitest';
import type { ActivityState, Delegation, Message } from '@/shared/types/domain';
import type { Transport } from '../transport';
import { createMockTransport } from './index';
import type { MockTransportOptions } from './index';

export interface MockHarness {
  transport: Transport;
  messages: Message[];
  activities: ActivityState[];
  stateChanges: number[];
  skillsChanged: string[];
  /** skill-library-changed を受け取った回数 */
  libraryChanges: number;
  /** delegation-changed で届いた値（届いた順） */
  delegations: Delegation[];
  restart: ReturnType<typeof vi.fn>;
  /** 予約されたタイマーをすべて進める（会話が終わるまで） */
  settle: () => Promise<void>;
}

export async function createHarness(options: MockTransportOptions = {}): Promise<MockHarness> {
  let counter = 0;
  const restart = vi.fn();
  const transport = createMockTransport({
    latencyMs: 0,
    runtimeStartupMs: 0,
    ...options,
    env: { newId: () => `id-${++counter}`, restart, ...options.env },
  });
  const harness: MockHarness = {
    transport,
    messages: [],
    activities: [],
    stateChanges: [],
    skillsChanged: [],
    libraryChanges: 0,
    delegations: [],
    restart,
    settle: () => vi.runAllTimersAsync().then(() => undefined),
  };
  await transport.listen('message-created', (message) => harness.messages.push(message));
  await transport.listen('activity-changed', (state) => harness.activities.push(state));
  await transport.listen('state-changed', () => harness.stateChanges.push(Date.now()));
  await transport.listen('skills-changed', ({ agentId }) => harness.skillsChanged.push(agentId));
  await transport.listen('skill-library-changed', () => {
    harness.libraryChanges += 1;
  });
  await transport.listen('delegation-changed', (delegation) => harness.delegations.push(delegation));
  return harness;
}
