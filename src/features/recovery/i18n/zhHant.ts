import type { Messages } from '@/shared/i18n';
import type { ja } from './ja';

export const zhHant: Messages<typeof ja> = {
  retry: '重試',
  choose: '選擇其他資料夾',
  useDefault: '改回預設位置',
  atDefault: '目前位置就是預設位置',
  kicker: '無法開啟資料資料夾',
  location: '位置',
  openFolder: '開啟資料夾',
  note: '即使改回預設位置，目前資料夾中的資料也不會被刪除。',
  details: '詳細資訊',
  restarting: '正在重新啟動…',
  fallbackTitle: '無法開啟資料資料夾',
  missingTitle: '找不到資料資料夾',
  missingDescription: '無法存取設定的位置。如果位於外接磁碟機或網路位置，請連接後重試。',
  lockedTitle: 'AI 公會已在執行',
  lockedDescription: '另一個使用同一資料資料夾的 AI 公會正在執行。請將其關閉後重試。',
  newerTitle: '這是新版本的資料',
  newerDescription:
    '此資料夾由較新版本的 AI 公會儲存。為保護資料，此版本不會開啟它。請更新應用程式，或選擇其他資料夾。',
  foreignTitle: '不是 AI 公會的資料資料夾',
  foreignDescription: '此資料夾中有非 AI 公會的檔案。為保護重要檔案，不會使用此資料夾。',
  corruptTitle: '無法讀取資料',
  corruptDescription: '資料庫可能已損壞。原始檔案未做任何變更。',
  notWritableTitle: '無法寫入此資料夾',
  notWritableDescription: '沒有寫入權限。請檢查資料夾的權限，或選擇其他資料夾。',
};
