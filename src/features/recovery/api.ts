// 復旧モードで動くコマンドだけを使う（design.md §3: get_storage_info・choose_folder・change_data_dir・reveal_data_dir・restart_app）。
import { invoke } from '@/shared/api';

export const recoveryApi = {
  storageInfo: () => invoke('get_storage_info'),
  chooseFolder: () => invoke('choose_folder'),
  /** 復旧では「その場所のデータを開く」で切り替える。成功するとアプリが再起動する */
  openDataDir: (path: string) => invoke('change_data_dir', { path, mode: 'open' }),
  revealDataDir: () => invoke('reveal_data_dir'),
  restartApp: () => invoke('restart_app'),
};
