import { createTranslator } from '../../i18n.ts';

export const t = createTranslator({
  ja: {
    limits:
      'Grok は検索・読み取り専用です。全OSでコマンド実行・ファイル書き込み・MEMORY.md更新はできません。費用はターンごとに集計し、$0.20に達したら次の要求を止めます。実行中の1回分は超過することがあり、厳密な課金上限ではありません。xAIの月次後払い上限は前払い残高の消費を制限しません。',
    ready: 'APIキーを確認済み（検索・読み取り専用）',
    key: 'Grok の API キーが必要です。',
  },
  en: {
    limits:
      'Grok supports search and reading only. Commands, file writes and MEMORY.md updates are disabled on every OS. Costs accumulate per turn; the next request stops at $0.20. One in-flight request may exceed this amount; this is not a strict billing cap. The xAI monthly postpaid limit does not cap prepaid balance spending.',
    ready: 'API key available (search and reading only)',
    key: 'A Grok API key is required.',
  },
  'zh-Hans': {
    limits:
      'Grok 仅支持搜索和读取。所有系统均禁用命令、文件写入和 MEMORY.md 更新。费用按轮累计，达到 $0.20 后停止下一次请求。正在执行的单次请求可能超额，这不是严格的计费上限。xAI 月度后付费限额不限制预付余额的消耗。',
    ready: 'API 密钥可用（仅搜索和读取）',
    key: '需要 Grok API 密钥。',
  },
  'zh-Hant': {
    limits:
      'Grok 僅支援搜尋和讀取。所有系統均停用命令、檔案寫入和 MEMORY.md 更新。費用按輪累計，達到 $0.20 後停止下一次請求。執行中的單次請求可能超額，這不是嚴格的計費上限。xAI 每月後付費限額不限制預付餘額的消耗。',
    ready: 'API 金鑰可用（僅搜尋和讀取）',
    key: '需要 Grok API 金鑰。',
  },
  ko: {
    limits:
      'Grok은 검색과 읽기만 지원합니다. 모든 OS에서 명령, 파일 쓰기와 MEMORY.md 갱신은 비활성화됩니다. 비용은 턴별로 누적되며 $0.20에 도달하면 다음 요청을 중지합니다. 진행 중인 요청은 초과할 수 있으므로 엄격한 청구 한도가 아닙니다. xAI 월별 후불 한도는 선불 잔액 사용을 제한하지 않습니다.',
    ready: 'API 키 확인됨 (검색과 읽기 전용)',
    key: 'Grok API 키가 필요합니다.',
  },
});
