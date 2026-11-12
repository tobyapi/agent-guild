import type { Messages } from '@/shared/i18n';
import type { ja } from './ja';

export const zhHans: Messages<typeof ja> = {
  cancel: '取消',
  close: '关闭',
  optional: '可选',
  add: '添加',
  notifications: '通知',
  dismissNotification: '关闭通知',
  colorLabel: '个人颜色',
  avatarLabel: '头像',
  avatarHint: '输入一个表情符号，或选择图片并裁剪（以 {size}px 保存）。',
  avatarImagePlaceholder: '图片',
  chooseImage: '选择图片',
  removeImage: '移除图片',
  cropTitle: '裁剪头像',
  cropConfirm: '使用此区域',
  cropLoading: '正在加载图片…',
  cropPreview: '预览',
  cropZoom: '缩放',
  cropZoomValue: '{zoom} 倍',
  cropReset: '复原',
  cropHelp: '拖动或使用方向键（按住 Shift 移动更多）调整位置，使用滑块、滚轮或 + / − 缩放。',
  cropArea: '裁剪区域',
};
