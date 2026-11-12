// データフォルダ（docs/design.md §11 の保存先の変更をモック用に）と、アプリの更新（design.md「アプリの更新」）。
import { fail } from '../runtime';
import { MOCK_CHOSEN_FOLDER } from '../seedIds';
import { RESTART_DELAY_MS } from './types';
import type { HandlerGroup } from './types';

type StorageCommands =
  'get_storage_info' | 'choose_folder' | 'change_data_dir' | 'reveal_data_dir' | 'check_update' | 'install_update';

const ABSOLUTE_PATH = /^(?:[a-z]:\\|\\\\|\/)/i;

export const storageHandlers: HandlerGroup<StorageCommands> = {
  get_storage_info: (_args, runtime) => runtime.state.storage,

  choose_folder: () => MOCK_CHOSEN_FOLDER,

  change_data_dir({ path, mode }, runtime) {
    const { storage } = runtime.state;
    if (storage.source === 'env')
      fail('validation', '環境変数 GUILD_DATA_DIR で保存先が固定されているため変更できません');
    if (!ABSOLUTE_PATH.test(path)) fail('validation', '絶対パスのフォルダを選んでください', 'path');
    if (path === storage.dataDir) fail('validation', 'いまの保存先と同じフォルダです', 'path');
    // モックの choose_folder が返すフォルダには「ギルドのデータがある」想定
    if (mode === 'copy' && path === MOCK_CHOSEN_FOLDER) {
      fail('conflict', '移動先にすでにデータがあります。『その場所のデータを開く』を選んでください。');
    }
    runtime.env.schedule(RESTART_DELAY_MS, runtime.env.restart);
    return null;
  },

  reveal_data_dir: () => null,

  check_update: (_args, runtime) => runtime.state.update,

  /** Rust はダウンロードして入れてから起動し直す。モックは起動し直すだけ（版は変わらない） */
  install_update(_args, runtime) {
    if (runtime.state.update.latest === null) fail('conflict', '新しい版はありません。いまの版が最新です');
    runtime.env.schedule(RESTART_DELAY_MS, runtime.env.restart);
    return null;
  },
};
