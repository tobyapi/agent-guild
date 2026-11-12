import type { Messages } from '../../../i18n.ts';
import type { ja } from './ja.ts';

export const zhHant: Messages<typeof ja> = {
  notFound: '需要設定 Codex。請在 AI 公會的「設定 → 後端 → Codex」中進行。',
  needsLogin: '要使用 Codex，請使用 ChatGPT 帳戶登入。',
  needsLoginTerminal: '請在終端機中執行 `codex login`，或設定環境變數 OPENAI_API_KEY。',
  loginLabel: '使用 ChatGPT 登入',
  loginWaiting: '請在瀏覽器中登入 ChatGPT。',
  loginFailed: '無法登入 ChatGPT。請檢查瀏覽器後再試一次。',
  runFailed: 'Codex 執行失敗（{detail}）',
  longPath: '在 Windows 上，路徑超過 260 個字元時無法啟動 Codex CLI。請將專案放在較短的路徑中。',
  systemPromptTooLong: '傳給 Codex 的系統提示最多 {max} 個字元',
  folderNeedsSandbox: '資料夾限制需要作業系統隔離（此後端可在支援隔離的 Windows 11 上使用）',
  ruleWrite: '允許寫入後，將無法阻止在工作區內執行命令（程式）。請同時允許 runCommands',
  ruleWriteAnywhere: '寫入工作區之外時會解除 sandbox，因此也無法阻止網路存取。請同時允許 writeFiles 與 webFetch',
  cannotStopReads: '無法阻止讀取檔案（Codex 透過 shell 讀取）',
  cannotStopSkills: '無法阻止使用技能（包括使用者全域的技能）',
  experimental: '{name}（實驗性支援・未經真實 API 驗證）',
  webSearch: '網頁搜尋',
  webAndXSearch: '網頁搜尋・X 搜尋',
  providerModel: '透過 Codex SDK。不支援{search}。會產生 API 使用費。',
  providerReady: '實驗性支援・未經真實 API 驗證。ready 僅表示已找到 API 金鑰與 CLI，不代表連線成功。',
  providerNeedsKey:
    '請在「設定 → 後端」中儲存 API 金鑰，或設定環境變數 {envVar} 後重新啟動應用程式。{name} 不支援網頁登入。',
  providerFailed: '{name} 執行失敗。請檢查 API 金鑰、用量額度、模型名稱與連線。',
  providerKeyRequired: '需要環境變數 {envVar}。',
  providerNoWebSearch: '{name} 不支援{search}。請關閉網頁搜尋。',
  providerEffort: '請從 {choices} 中選擇 {name} 的推理深度。',
  providerModelOnly: '{name} 請選擇 {model}。',
};
