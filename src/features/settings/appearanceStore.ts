import { createStore, type StoreApi } from 'zustand/vanilla';
import { themeRegistry } from '@/shared/theme/registry';
import { resolveAppearance } from '@/shared/theme/resolve';
import type { AppearancePreference, ResolvedAppearance, ThemeRegistry } from '@/shared/theme/types';
import { checkTheme, type ContrastIssue } from '@/shared/theme/checkTheme';
import { isSavedTheme, type SavedTheme } from '@/shared/theme/candidate';
import {
  emptyLibrary,
  loadLibrary,
  libraryRegistry,
  LIBRARY_KEY,
  removeTheme,
  switchTheme,
  type ThemeLibrary,
} from './themeLibrary';
import { paintTheme } from './themeDocument';
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
  root.dataset.glass = appearance.glass;
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

interface AppearanceState extends ThemeLibrary {
  preference: AppearancePreference;
  registry: ThemeRegistry;
  readOnly: boolean;
  problem: 'save' | 'contrast' | 'missing' | null;
  issues: ContrastIssue[];
  missingId: string | null;
}
function libraryWriter(
  store: StoreApi<AppearanceState>,
  base: ThemeRegistry,
  environment: AppearancePersistence,
  apply: () => void,
) {
  function install(library: ThemeLibrary) {
    const { themes, active, previous } = library;
    const registry = libraryRegistry(base, themes);
    const background = resolveAppearance(active, registry, 'dark').backgroundOverride;
    store.setState({
      themes,
      active,
      previous,
      preference: active,
      registry,
      problem: null,
      issues: [],
      missingId:
        background.kind === 'image' && background.assetId === store.getState().missingId ? background.assetId : null,
    });
    apply();
  }
  function commit(library: ThemeLibrary) {
    if (store.getState().readOnly) return false;
    const { themes, active, previous } = library;
    const theme = themes.find((t) => t.id === active.themeId);
    const issues = theme ? checkTheme(theme, active.accentOverride) : [];
    if (issues.length) {
      store.setState({ problem: 'contrast', issues });
      return false;
    }
    try {
      environment.storage().setItem(LIBRARY_KEY, JSON.stringify({ version: 3, themes, active, previous }));
    } catch {
      environment.warn(LIBRARY_KEY + ' could not be saved');
      store.setState({ problem: 'save' });
      return false;
    }
    install(library);
    return true;
  }
  function saveTheme(theme: SavedTheme, activate: boolean) {
    const state = store.getState();
    if (!isSavedTheme(theme) || state.themes.some((t) => t.id === theme.id) || checkTheme(theme).length) return false;
    const library = { ...state, themes: [...state.themes, theme] };
    return commit(activate ? switchTheme(library, theme.id) : library);
  }
  return { install, commit, saveTheme };
}
export function createAppearanceStore(
  environment: AppearanceEnvironment = browserEnvironment(),
  base: ThemeRegistry = themeRegistry,
) {
  const initial = emptyLibrary();
  const store = createStore<AppearanceState>()(() => ({
    ...initial,
    preference: initial.active,
    registry: base,
    readOnly: false,
    problem: null,
    issues: [],
    missingId: null,
  }));
  let initialized = false;
  let query: SystemSchemeQuery | undefined;
  function apply() {
    const state = store.getState();
    const resolved = resolveAppearance(state.active, state.registry, query?.matches ? 'light' : 'dark');
    const root = environment.root();
    const missing =
      resolved.backgroundOverride.kind === 'image' && resolved.backgroundOverride.assetId === state.missingId;
    applyAppearance(root, missing ? { ...resolved, backgroundOverride: { kind: 'none' }, glass: 'none' } : resolved);
    paintTheme(
      root,
      resolved,
      state.themes.find((t) => t.id === resolved.themeId),
    );
  }
  const { install, commit, saveTheme } = libraryWriter(store, base, environment, apply);
  const onSchemeChange = () => {
    if (store.getState().active.schemePreference === 'system') apply();
  };
  return {
    store,
    saveTheme,
    missingImage(id: string) {
      store.setState({ missingId: id });
      apply();
    },
    init() {
      if (initialized) return;
      initialized = true;
      const { library, readOnly } = loadLibrary(environment, base);
      store.setState({ readOnly });
      query = environment.matchMedia();
      query?.addEventListener('change', onSchemeChange);
      install(library);
    },
    setPreference(active: AppearancePreference) {
      return commit({ ...store.getState(), active });
    },
    select(id: string) {
      return commit(switchTheme(store.getState(), id));
    },
    remove(id: string) {
      return commit(removeTheme(store.getState(), id));
    },
    undo() {
      const state = store.getState();
      return !!state.previous && commit({ ...state, active: state.previous, previous: null });
    },
    dispose() {
      query?.removeEventListener('change', onSchemeChange);
      query = undefined;
      initialized = false;
    },
  };
}
