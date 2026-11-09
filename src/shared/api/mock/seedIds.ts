/** 初期データの固定 ID（テストと初期メッセージから参照する） */
export const SEED_IDS = {
  lobby: 'channel-lobby',
  hal: 'agent-hal',
  sora: 'agent-sora',
  logica: 'agent-logica',
  gear: 'agent-gear',
  kaname: 'agent-kaname',
} as const;

export const MOCK_DEFAULT_DATA_DIR = 'C:\\Users\\you\\AppData\\Local\\com.agentguild.app';
/** choose_folder が返すフォルダ（OS のダイアログの代わり）。ギルドのデータがある想定で、copy は conflict になる */
export const MOCK_CHOSEN_FOLDER = 'D:\\GuildData';
/** 復旧モードで起動したときの「開けなかったデータフォルダ」 */
export const MOCK_BROKEN_DATA_DIR = 'E:\\GuildData';
