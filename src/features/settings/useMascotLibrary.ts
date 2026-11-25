import { useEffect, useState } from 'react';
import { settingsApi } from './api';
import { deleteGeneratedMascot } from './appearance';

export function useMascotLibrary() {
  const [result, setResult] = useState<string[] | 'error' | null>(null);
  const [target, setTarget] = useState<{ id: string; label: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    void settingsApi.listMascots().then(
      (ids) => {
        if (active) setResult(ids);
      },
      () => {
        if (active) setResult('error');
      },
    );
    return () => {
      active = false;
    };
  }, []);

  function ask(id: string, label: string) {
    setFailed(false);
    setTarget({ id, label });
  }

  function cancel() {
    if (!busy) setTarget(null);
  }

  async function remove() {
    if (!target || busy || !Array.isArray(result)) return;
    setBusy(true);
    setFailed(false);
    try {
      await deleteGeneratedMascot(target.id);
      setResult(result.filter((id) => id !== target.id));
      setTarget(null);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  return { result, target, busy, failed, ask, cancel, remove };
}
