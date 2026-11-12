import { invoke } from '@/shared/api';
import type { DataDirMode, Language } from '@/shared/types/domain';

export const settingsApi = {
  backendApiKey: (backendId: string, action: 'status' | 'set' | 'delete', key?: string) =>
    invoke('backend_api_key', { backendId, action, key }),
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
