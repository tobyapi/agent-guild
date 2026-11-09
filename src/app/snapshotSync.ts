// スナップショットの取り直し。state-changed が続けて届いても、最後に頼んだ結果だけを反映する。
import type { Snapshot } from '@/shared/types/domain';

export interface SnapshotSyncOptions<M> {
  fetch: () => Promise<Snapshot>;
  /** 取得を始める直前に呼ぶ（例: その時点の activity の版）。結果は apply に渡る */
  mark: () => M;
  apply: (snapshot: Snapshot, mark: M) => void;
}

export interface SnapshotSync {
  refresh: () => Promise<void>;
}

export function createSnapshotSync<M>({ fetch, mark, apply }: SnapshotSyncOptions<M>): SnapshotSync {
  let latest = 0;
  return {
    async refresh() {
      latest += 1;
      const ticket = latest;
      const marked = mark();
      const snapshot = await fetch();
      if (ticket === latest) apply(snapshot, marked);
    },
  };
}
