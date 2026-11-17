import { invoke } from '@/shared/api';
import type { DataDirMode, Language } from '@/shared/types/domain';

export const settingsApi = {
  getGlobalInstructions: () => invoke('get_global_instructions'),
  setGlobalInstructions: (instructions: string) => invoke('set_global_instructions', { instructions }),
  importBackground: (data: string) => invoke('import_background_image', { data }),
  listBackgrounds: () => invoke('list_background_images'),
  getBackground: (id: string) => invoke('get_background_image', { id }),
  deleteBackground: (id: string) => invoke('delete_background_image', { id }),
  backendApiKey: (backendId: string, action: 'status' | 'set' | 'delete', key?: string) =>
    invoke('backend_api_key', { backendId, action, key }),
  backendAuthModes: () => invoke('get_backend_auth_modes'),
  setBackendAuthMode: (backendId: string, mode: 'desktop' | 'api') =>
    invoke('set_backend_auth_mode', { backendId, mode }),
  storageInfo: () => invoke('get_storage_info'),
  chooseFolder: () => invoke('choose_folder'),
  /** 成功するとアプリが再起動する */
  changeDataDir: (path: string, mode: DataDirMode) => invoke('change_data_dir', { path, mode }),
  revealDataDir: () => invoke('reveal_data_dir'),
  completeSetup: () => invoke('complete_setup'),
  setLanguage: (language: Language) => invoke('set_language', { language }),
  openUrl: (url: string) => invoke('open_url', { url }),
  installBackendCli: (backendId: string) => invoke('install_backend_cli', { backendId }),
};
