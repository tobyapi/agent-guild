import type { RunLimits } from '@/shared/types/domain';
import { invoke } from '@/shared/api';
import type { DataDirMode, Language } from '@/shared/types/domain';

export const settingsApi = {
  generateTheme: (requestId: string, backendId: string, subject: string) =>
    invoke('generate_theme', { requestId, backendId, subject }),
  cancelTheme: (requestId: string) => invoke('cancel_theme_generation', { requestId }),
  getRunLimits: () => invoke('get_run_limits'),
  setRunLimits: (limits: RunLimits) => invoke('set_run_limits', { limits }),
  getGlobalInstructions: () => invoke('get_global_instructions'),
  setGlobalInstructions: (instructions: string) => invoke('set_global_instructions', { instructions }),
  generateBackground: (requestId: string, backendId: string, description: string) =>
    invoke('generate_background_image', { requestId, backendId, description }),
  generateMascot: (requestId: string, backendId: string, description: string) =>
    invoke('generate_mascot_image', { requestId, backendId, description }),
  listMascots: () => invoke('list_mascot_images'),
  getMascot: (id: string) => invoke('get_mascot_image', { id }),
  deleteMascot: (id: string) => invoke('delete_mascot_image', { id }),
  cancelBackgroundGeneration: (requestId: string) => invoke('cancel_background_generation', { requestId }),
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
