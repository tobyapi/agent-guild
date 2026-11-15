import { useEffect, useState } from 'react';
import type { MotionPreference } from '@/shared/theme/types';

/** Re-evaluate all stop conditions together, including when the document returns. */
export function useBackdropMotion(preference: MotionPreference): boolean {
  const [environment, setEnvironment] = useState(() => ({
    reduced: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false,
    visible: document.visibilityState === 'visible',
  }));
  useEffect(() => {
    const query = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const update = () =>
      setEnvironment({ reduced: query?.matches ?? false, visible: document.visibilityState === 'visible' });
    update();
    query?.addEventListener('change', update);
    document.addEventListener('visibilitychange', update);
    return () => {
      query?.removeEventListener('change', update);
      document.removeEventListener('visibilitychange', update);
    };
  }, []);
  return preference !== 'off' && !environment.reduced && environment.visible;
}
