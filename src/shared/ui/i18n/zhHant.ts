import type { Messages } from '@/shared/i18n';
import type { ja } from './ja';

export const zhHant: Messages<typeof ja> = {
  cancel: '取消',
  close: '關閉',
  optional: '選填',
  add: '新增',
  notifications: '通知',
  dismissNotification: '關閉通知',
  colorLabel: '個人顏色',
  avatarLabel: '頭像',
  avatarHint: '輸入一個表情符號，或選擇圖片並裁切（以 {size}px 儲存）。',
  avatarImagePlaceholder: '圖片',
  chooseImage: '選擇圖片',
  removeImage: '移除圖片',
  cropTitle: '裁切頭像',
  cropConfirm: '使用此範圍',
  cropLoading: '正在載入圖片…',
  cropPreview: '預覽',
  cropZoom: '縮放',
  cropZoomValue: '{zoom} 倍',
  cropReset: '還原',
  cropHelp: '拖曳或使用方向鍵（按住 Shift 移動更多）調整位置，使用滑桿、滾輪或 + / − 縮放。',
  cropArea: '裁切範圍',
};
