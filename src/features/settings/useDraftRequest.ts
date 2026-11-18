import { useEffect, useRef, useState } from 'react';
import { settingsApi } from './api';

interface Request {
  id: string;
  kind: 'palette' | 'image';
}
function cancel(request: Request) {
  return request.kind === 'palette'
    ? settingsApi.cancelTheme(request.id)
    : settingsApi.cancelBackgroundGeneration(request.id);
}
export function useDraftRequest(onClose: () => void, onCancelError: () => void) {
  const [stopping, setStopping] = useState(false);
  const job = useRef<Request | null>(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      const old = job.current;
      job.current = null;
      if (old) void cancel(old).catch(() => undefined);
    };
  }, []);
  function current(request: Request) {
    return mounted.current && job.current === request;
  }

  const closing = useRef(false);
  function start(kind: Request['kind']) {
    const request = { id: crypto.randomUUID(), kind };
    job.current = request;
    return request;
  }
  async function close() {
    if (closing.current) return;
    closing.current = true;
    const request = job.current;
    job.current = null;
    if (request) {
      setStopping(true);
      try {
        await cancel(request);
      } catch {
        if (mounted.current) {
          closing.current = false;
          setStopping(false);
          onCancelError();
        }
        return;
      }
    }
    if (mounted.current) onClose();
  }
  return {
    start,
    current,
    finish: (request: Request) => {
      if (current(request)) job.current = null;
    },
    busy: () => !!job.current || closing.current,
    stopping,
    close,
  };
}
