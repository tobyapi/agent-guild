import { useEffect, useState } from 'react';
import { settingsApi } from './api';
import { clearBackgroundIfSelected } from './appearance';

const images = new Map<string, { users: number; promise: Promise<string> }>();

/** Share pending reads; release full-size data URLs when their last view unmounts. */
export function useBackgroundImage(id: string | null): string | null {
  const [loaded, setLoaded] = useState<{ id: string; url: string } | null>(null);
  useEffect(() => {
    if (!id) return;
    let active = true;
    let entry = images.get(id);
    if (!entry) {
      entry = { users: 0, promise: settingsApi.getBackground(id) };
      images.set(id, entry);
    }
    entry.users++;
    entry.promise.then(
      (url) => {
        if (active) setLoaded({ id, url });
      },
      () => {
        if (active) clearBackgroundIfSelected(id);
      },
    );
    return () => {
      active = false;
      setLoaded(null);
      if (--entry.users === 0) images.delete(id);
    };
  }, [id]);
  return loaded?.id === id ? loaded.url : null;
}
