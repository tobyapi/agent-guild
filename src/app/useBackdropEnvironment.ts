import { useSyncExternalStore } from 'react';

function subscribe(update: () => void) {
  let frame: number | null = null;
  const schedule = () => {
    if (frame !== null) return;
    frame = requestAnimationFrame(() => {
      frame = null;
      update();
    });
  };
  const observer = new MutationObserver(schedule);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  window.addEventListener('resize', schedule);
  return () => {
    if (frame !== null) cancelAnimationFrame(frame);
    observer.disconnect();
    window.removeEventListener('resize', schedule);
  };
}

function snapshot() {
  return `${document.documentElement.dataset.theme}:${Math.max(1, window.innerWidth)}:${Math.max(1, window.innerHeight)}`;
}

/** Root attributes include OS scheme changes applied by the appearance controller. */
export function useBackdropEnvironment() {
  const [theme, width, height] = useSyncExternalStore(subscribe, snapshot).split(':');
  return {
    scheme: theme === 'light' ? ('light' as const) : ('dark' as const),
    viewport: [Number(width), Number(height)] as const,
  };
}
