import { invoke } from '@/shared/api';
import type { CommandArgs } from '@/shared/api';
import type { DataDirMode } from '@/shared/types/domain';

export type SetupBackend = CommandArgs<'install_backend_cli'>['backendId'];

export const settingsApi = {
  backendApiKey: (backendId: string, action: 'status' | 'set' | 'delete', key?: string) =>
    invoke('backend_api_key', { backendId, action, key }),
  storageInfo: () => invoke('get_storage_info'),
  chooseFolder: () => invoke('choose_folder'),
  /** 成功するとアプリが再起動する */
  changeDataDir: (path: string, mode: DataDirMode) => invoke('change_data_dir', { path, mode }),
  revealDataDir: () => invoke('reveal_data_dir'),
  completeSetup: () => invoke('complete_setup'),
  openUrl: (url: string) => invoke('open_url', { url }),
  installBackendCli: (backendId: SetupBackend) => invoke('install_backend_cli', { backendId }),
};
