import { useEffect, useState } from 'react';
import { errorCode } from '@/shared/lib/errors';
import { settingsApi } from './api';
import { missingBackground, setBackground } from './appearance';
import { BackgroundInputError, readBackground } from './model/readBackground';
import { tAppearance as t } from './i18n/appearance';

export function useBackgroundLibrary(revision: number) {
  const [ids, setIds] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    settingsApi.listBackgrounds().then(
      (items) => {
        if (active) setIds((current) => [...new Set([...items, ...current])].sort());
      },
      () => {
        if (active) setError(t('backgroundUnavailable'));
      },
    );
    return () => {
      active = false;
    };
  }, [revision]);
  function generated(id: string) {
    setIds((items) => [...new Set([...items, id])].sort());
    setBackground({ kind: 'image', assetId: id });
  }
  async function add(file: File) {
    setBusy(true);
    setError('');
    try {
      const id = await settingsApi.importBackground(await readBackground(file));
      generated(id);
    } catch (cause) {
      setError(
        t(
          cause instanceof BackgroundInputError
            ? cause.reason
            : errorCode(cause) === 'unavailable'
              ? 'backgroundUnavailable'
              : 'backgroundBroken',
        ),
      );
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    if (!removing) return;
    setBusy(true);
    try {
      await settingsApi.deleteBackground(removing);
      missingBackground(removing);
      setIds((items) => items.filter((id) => id !== removing));
      setRemoving(null);
    } catch {
      setError(t('backgroundFailed'));
    } finally {
      setBusy(false);
    }
  }
  return { ids, error, busy, removing, setRemoving, add, remove, generated };
}
