import type { Messages } from '@/shared/i18n';
import type { ja } from './ja';

export const en: Messages<typeof ja> = {
  label: 'Avatar frame',
  none: 'None',
  oak: 'Oaken Study',
  harbor: 'Harbor Rope',
  clockwork: 'Clockmaker’s Bench',
  teatime: 'Midnight Tea Party',
  moth: 'Moth and Lantern',
  raven: 'Weathervane Raven',
  masquerade: 'Masquerade',
  astrolabe: 'Stargazer’s Orrery',
  generate: 'Generate…',
  remove: 'Delete “{name}”',
  removeTitle: 'Delete this frame?',
  removeMessage: '“{name}” will be deleted. Members wearing it will go back to no frame.',
  removeConfirm: 'Delete',
  dialogTitle: 'Generate an avatar frame',
  dialogDescription:
    'Describe a theme and an AI paints an original, painterly frame as an image. The background and the center are made transparent before it is saved.',
  description: 'Theme',
  descriptionPlaceholder: 'Moonlit roses and chains',
  descriptionHint: 'Briefly describe the mood, motifs and colors (up to 200 characters)',
  descriptionEmpty: 'Describe the frame you want',
  descriptionTooLong: 'Keep the theme within 200 characters',
  name: 'Name',
  nameHint: 'Left empty, the theme becomes the name',
  backendHint:
    'The image is generated with the account signed in to {backend} (it may be unavailable for some accounts or plans)',
  noReadyBackends:
    'No backend that can generate frames is ready. Check its connection or sign-in under Backends in Settings.',
  generating: 'Painting… (this can take a few minutes; Stop cancels it)',
  cancel: 'Cancel',
  stop: 'Stop',
  submit: 'Generate',
  generated: 'Created the frame “{name}”',
};
