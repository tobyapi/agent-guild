import type { Messages } from '@/shared/i18n';
import type { ja } from './ja';

export const en: Messages<typeof ja> = {
  cancel: 'Cancel',
  close: 'Close',
  optional: 'Optional',
  add: 'Add',
  notifications: 'Notifications',
  dismissNotification: 'Dismiss notification',
  colorLabel: 'Personal color',
  avatarLabel: 'Avatar',
  avatarHint: 'Type a single emoji, or choose an image and crop it (saved at {size}px).',
  avatarImagePlaceholder: 'Image',
  chooseImage: 'Choose image',
  removeImage: 'Remove image',
  cropTitle: 'Crop avatar',
  cropConfirm: 'Use this area',
  cropLoading: 'Loading image…',
  cropPreview: 'Preview',
  cropZoom: 'Zoom',
  cropZoomValue: '{zoom}×',
  cropReset: 'Reset',
  cropHelp:
    'Drag or use the arrow keys (Shift for larger steps) to move. Use the slider, mouse wheel, or + / − to zoom.',
  cropArea: 'Crop area',
};
