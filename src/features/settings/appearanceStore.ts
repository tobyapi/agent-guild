import { createStore } from 'zustand/vanilla';
import { defaultAppearance, themeRegistry } from '@/shared/theme/registry';
import { resolveAppearance } from '@/shared/theme/resolve';
import type { AppearancePreference, ResolvedAppearance, ThemeRegistry } from '@/shared/theme/types';
import { loadAppearance, saveAppearance } from './appearancePersistence';
import type { AppearancePersistence } from './appearancePersistence';

const LIGHT_QUERY = '(prefers-color-scheme: light)';
type SystemSchemeQuery = Pick<MediaQueryList, 'matches' | 'addEventListener' | 'removeEventListener'>;

interface AppearanceEnvironment extends AppearancePersistence {
  matchMedia: () => SystemSchemeQuery | undefined;
  root: () => HTMLElement | undefined;
}

function browserEnvironment(): AppearanceEnvironment {
  return {
    storage: () => localStorage,
    warn: (message) => console.warn(message),
    matchMedia: () => (typeof window === 'undefined' ? undefined : window.matchMedia?.(LIGHT_QUERY)),
    root: () => (typeof document === 'undefined' ? undefined : document.documentElement),
  };
}

export function applyAppearance(root: HTMLElement | undefined, appearance: ResolvedAppearance): void {
  if (!root) return;
  root.dataset.theme = appearance.scheme;
  root.dataset.themeId = appearance.themeId;
  if (appearance.backgroundOverride.kind === 'none') {
    delete root.dataset.background;
    delete root.dataset.backgroundSource;
  } else {
    root.dataset.background = 'active';
    root.dataset.backgroundSource = appearance.backgroundOverride.kind;
  }
  if (appearance.accentOverride === null) delete root.dataset.accent;
  else root.dataset.accent = appearance.accentOverride;
}

/** Inert until init is explicitly called before the app's first render. */
export function createAppearanceStore(
  environment: AppearanceEnvironment = browserEnvironment(),
  registry: ThemeRegistry = themeRegistry,
) {
  const store = createStore<{ preference: AppearancePreference }>()(() => ({ preference: defaultAppearance() }));
  let initialized = false;
  let query: SystemSchemeQuery | undefined;
  const apply = () => {
    const scheme = query?.matches ? 'light' : 'dark';
    applyAppearance(environment.root(), resolveAppearance(store.getState().preference, registry, scheme));
  };
  const onSchemeChange = () => {
    if (store.getState().preference.schemePreference === 'system') apply();
  };
  return {
    store,
    init() {
      if (initialized) return;
      initialized = true;
      store.setState({ preference: loadAppearance(environment, registry) });
      query = environment.matchMedia();
      query?.addEventListener('change', onSchemeChange);
      apply();
    },
    setPreference(preference: AppearancePreference) {
      store.setState({ preference });
      apply();
      saveAppearance(environment, preference);
    },
    dispose() {
      query?.removeEventListener('change', onSchemeChange);
      query = undefined;
      initialized = false;
    },
  };
}
