import { invoke } from '@/shared/api';

export const updateApi = {
  /** 新しい版があるかを配布元に確かめる */
  check: () => invoke('check_update'),
  /** 新しい版を入れて、アプリを起動し直す */
  install: () => invoke('install_update'),
};
