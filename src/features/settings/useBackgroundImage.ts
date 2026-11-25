import { useEffect, useState } from 'react';
import { settingsApi } from './api';
import { missingBackground } from './appearance';

const backgroundImages = new Map<string, LibraryEntry>();
const mascotImages = new Map<string, LibraryEntry>();
type LibraryEntry = { users: number; promise: Promise<string> };
const readBackground = (id: string) => settingsApi.getBackground(id);
const readMascot = (id: string) => settingsApi.getMascot(id);

export function useBackgroundImage(id: string | null, activeBackground = false): string | null {
  return useLibraryImage(id, backgroundImages, readBackground, activeBackground ? missingBackground : undefined);
}

export function useMascotImage(id: string | null): string | null {
  return useLibraryImage(id, mascotImages, readMascot);
}

/** Share pending reads; release full-size data URLs when their last view unmounts. */
function useLibraryImage(
  id: string | null,
  images: Map<string, LibraryEntry>,
  read: (id: string) => Promise<string>,
  onMissing?: (id: string) => void,
): string | null {
  const [loaded, setLoaded] = useState<{ id: string; url: string } | null>(null);
  useEffect(() => {
    if (!id) return;
    let active = true;
    let entry = images.get(id);
    if (!entry) {
      entry = { users: 0, promise: read(id) };
      images.set(id, entry);
    }
    entry.users++;
    entry.promise.then(
      (url) => {
        if (active) setLoaded({ id, url });
      },
      () => {
        if (active) onMissing?.(id);
      },
    );
    return () => {
      active = false;
      setLoaded(null);
      if (--entry.users === 0) images.delete(id);
    };
  }, [id, images, read, onMissing]);
  return loaded?.id === id ? loaded.url : null;
}
