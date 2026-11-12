// 起動処理: 先に全イベントを購読 → get_boot_status → ok なら get_snapshot、recovery なら復旧画面。
// イベントは各 feature のストアへ配線する（state-changed → スナップショット再取得、ほかはそれぞれのストアへ）。
import { useCallback, useEffect, useState } from 'react';
import { applyAgentsSnapshot } from '@/features/agents';
import { applyChannelsSnapshot } from '@/features/channels';
import { receiveDelegation, receiveMessage } from '@/features/chat';
import { applyFramesSnapshot } from '@/features/frames';
import { applyGuildSnapshot } from '@/features/guild';
import { applyProfileSnapshot, currentProfile } from '@/features/profile';
import { applyRuntimeSnapshot, currentActivityRevision, setActivity } from '@/features/runtime';
import { openSetup } from '@/features/settings';
import { reloadSkillLibraryIfLoaded, reloadSkillsIfLoaded } from '@/features/skills';
import { playMessageSound } from '@/features/sounds';
import { invoke } from '@/shared/api';
import { applyBootLanguage } from '@/shared/i18n';
import { errorMessage } from '@/shared/lib/errors';
import { reportError } from '@/shared/ui';
import type { BootStatus, Message, Snapshot } from '@/shared/types/domain';
import { subscribeBackendEvents } from './backendEvents';
import { createSnapshotSync } from './snapshotSync';

export type BootState =
  | { phase: 'loading' }
  | { phase: 'ready' }
  | { phase: 'recovery'; boot: BootStatus }
  | { phase: 'failed'; message: string };

function applySnapshot(snapshot: Snapshot, activityRevision: number): void {
  applyGuildSnapshot(snapshot.guild);
  applyProfileSnapshot(snapshot.me);
  applyFramesSnapshot(snapshot.frames);
  applyAgentsSnapshot(snapshot.agents, snapshot.templates);
  applyRuntimeSnapshot(snapshot, activityRevision);
  applyChannelsSnapshot(snapshot.channels);
}

/** message-created: 会話に足し、設定に合えば通知の音を鳴らす（ライブで届いた発言だけがここを通る） */
function receiveLiveMessage(message: Message): void {
  receiveMessage(message);
  playMessageSound(message, currentProfile().name);
}

export function useBootstrap() {
  const [state, setState] = useState<BootState>({ phase: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    const sync = createSnapshotSync({
      fetch: () => invoke('get_snapshot'),
      mark: currentActivityRevision,
      apply: applySnapshot,
    });
    const events = subscribeBackendEvents({
      'message-created': receiveLiveMessage,
      'activity-changed': setActivity,
      'state-changed': () => void sync.refresh().catch(reportError),
      'skills-changed': ({ agentId }) => reloadSkillsIfLoaded(agentId),
      'skill-library-changed': reloadSkillLibraryIfLoaded,
      'delegation-changed': receiveDelegation,
    });
    const start = async (): Promise<BootState> => {
      await events.ready;
      const boot = await invoke('get_boot_status');
      applyBootLanguage(boot.language, boot.needsSetup);
      if (boot.state === 'recovery') return { phase: 'recovery', boot };
      await sync.refresh();
      // 初回起動なら、本体の上に初期設定のダイアログを出す
      if (boot.needsSetup) openSetup();
      return { phase: 'ready' };
    };
    start()
      .catch((error: unknown): BootState => ({ phase: 'failed', message: errorMessage(error) }))
      .then((next) => {
        if (active) setState(next);
      }, reportError);
    return () => {
      active = false;
      events.dispose();
    };
  }, [attempt]);

  const retry = useCallback(() => {
    setState({ phase: 'loading' });
    setAttempt((count) => count + 1);
  }, []);

  return { state, retry };
}
