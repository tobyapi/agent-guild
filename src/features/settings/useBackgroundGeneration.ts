import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { useBackends } from '@/features/runtime';
import { settingsApi } from './api';
import { tAppearance as t } from './i18n/appearance';

export function useBackgroundGeneration(onGenerated: (id: string) => void, onClose: (cancelled: boolean) => void) {
  const backends = useBackends().filter((b) => b.backgroundGeneration && b.status === 'ready');
  const [selected, setSelected] = useState('');
  const backendId = backends.some((b) => b.id === selected) ? selected : (backends[0]?.id ?? '');
  const [description, setDescription] = useState('');
  const [pending, setPending] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [error, setError] = useState('');
  const [descriptionError, setDescriptionError] = useState('');
  const request = useRef(crypto.randomUUID());
  const active = useRef(true);
  const running = useRef(false);
  const cancelled = useRef(false);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
      if (running.current && !cancelled.current)
        void settingsApi.cancelBackgroundGeneration(request.current).catch(() => undefined);
    };
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    event.stopPropagation();
    if (running.current || !backendId) return;
    if (!description.trim() || Array.from(description.trim()).length > 200) {
      setDescriptionError(t('backgroundSubjectInvalid'));
      return;
    }
    setDescriptionError('');
    setError('');
    request.current = crypto.randomUUID();
    setPending(true);
    running.current = true;
    cancelled.current = false;
    try {
      const id = await settingsApi.generateBackground(request.current, backendId, description.trim());
      running.current = false;
      if (active.current && !cancelled.current) onGenerated(id);
    } catch {
      if (active.current && !cancelled.current) setError(t('backgroundGenerationFailed'));
    } finally {
      running.current = false;
      if (active.current) setPending(false);
    }
  }

  async function close() {
    if (stopping) return;
    if (running.current) {
      cancelled.current = true;
      setStopping(true);
      try {
        await settingsApi.cancelBackgroundGeneration(request.current);
      } catch {
        if (active.current) {
          cancelled.current = false;
          setStopping(false);
          setError(t('backgroundCancelFailed'));
        }
        return;
      }
    }
    if (active.current) onClose(cancelled.current);
  }
  return {
    backends,
    backendId,
    setSelected,
    description,
    setDescription,
    pending,
    stopping,
    error,
    descriptionError,
    submit,
    close,
  };
}
