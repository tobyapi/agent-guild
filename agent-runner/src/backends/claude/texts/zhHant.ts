import type { Messages } from '../../../i18n.ts';
import type { ja } from './ja.ts';

export const zhHant: Messages<typeof ja> = {
  notFound: '需要設定 Claude。請在 AI 公會的「設定 → 後端 → Claude」中進行。',
  loginAtRun: '登入狀態將在執行時確認',
  needsLogin: '要使用 Claude，請在瀏覽器中登入 Claude 帳戶。',
  needsLoginTerminal: '尚未登入 Claude。請在終端機中執行 `claude auth login`，或設定環境變數 ANTHROPIC_API_KEY。',
  loginFailed: '無法登入 Claude。請檢查瀏覽器後再試一次。',
  loginWindowFailed: '無法開啟登入視窗（{reason}）',
  loginIncomplete: 'Claude 登入未完成。請在開啟的視窗與瀏覽器中完成登入',
  loginLabel: '使用 Claude Code 登入',
  loginWaiting: '請在開啟的視窗與瀏覽器中繼續登入。完成後狀態會自動更新。',
  maxTurnsLabel: '最大回合數',
  maxTurnsDescription: '一次回覆中使用工具往返的次數上限',
  operationCheckLabel: '操作確認',
  operationCheckDescription:
    '在執行命令、開啟網頁或寫入工作資料夾之外之前，用小模型（Haiku）確認是否符合請求，可疑時停止（不詢問人類）',
  folderUnsupported: 'Claude 的檔案操作無法限制檢查後替換連結，因此不能在指定資料夾中執行',
  runFailed: '無法執行 Claude（{detail}）',
  hintAuth: 'Claude 驗證失敗。請在終端機中執行 `claude` 登入，或設定環境變數 ANTHROPIC_API_KEY。',
  hintRateLimit: '由於 Claude 的使用上限、速率限制或壅塞，無法執行。請稍候再傳送訊息。',
  hintModelNotFound: '找不到指定的模型。請檢查代理人設定中的模型名稱。',
  hintDetail: '{hint}（{detail}）',
  failed: 'Claude 發生錯誤（{detail}）',
  interrupted: 'Claude 的執行中途結束（{detail}）',
  imageType: '不支援的圖片格式: {type}',
  imageRead: '無法讀取附件圖片（{path}）',
  ruleWrite: '如果允許寫入工作區之外，也請允許寫入檔案',
  ruleBash: '允許執行命令後，將無法阻止檔案讀寫（包括工作區之外）與網路存取',
};
