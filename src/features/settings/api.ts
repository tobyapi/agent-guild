import { invoke } from '@/shared/api';
import type { DataDirMode } from '@/shared/types/domain';

export const settingsApi = {
  storageInfo: () => invoke('get_storage_info'),
  chooseFolder: () => invoke('choose_folder'),
  /** 成功するとアプリが再起動する */
  changeDataDir: (path: string, mode: DataDirMode) => invoke('change_data_dir', { path, mode }),
  revealDataDir: () => invoke('reveal_data_dir'),
};
