import { describe, expect, it, vi } from 'vitest';
import type { Snapshot } from '@/shared/types/domain';
import { createSnapshotSync } from './snapshotSync';

function deferred() {
  let resolve: (snapshot: Snapshot) => void = () => undefined;
  const promise = new Promise<Snapshot>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

const snapshot = (name: string) => ({ me: { name, avatar: '', color: '' } }) as Snapshot;

describe('createSnapshotSync', () => {
  it('続けて頼んだら、最後に頼んだ結果だけを反映する（先に頼んだ結果が後から届いても捨てる）', async () => {
    const first = deferred();
    const second = deferred();
    const fetch = vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const apply = vi.fn();
    let revision = 0;
    const sync = createSnapshotSync({ fetch, mark: () => ++revision, apply });

    const older = sync.refresh();
    const newer = sync.refresh();
    second.resolve(snapshot('新しい'));
    await newer;
    first.resolve(snapshot('古い'));
    await older;

    expect(apply).toHaveBeenCalledTimes(1);
    expect(apply).toHaveBeenCalledWith(snapshot('新しい'), 2);
  });

  it('取得に失敗したら reject を返し、何も反映しない', async () => {
    const apply = vi.fn();
    const sync = createSnapshotSync({ fetch: () => Promise.reject(new Error('失敗')), mark: () => 0, apply });
    await expect(sync.refresh()).rejects.toThrow('失敗');
    expect(apply).not.toHaveBeenCalled();
  });
});
