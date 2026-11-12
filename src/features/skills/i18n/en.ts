import type { Messages } from '@/shared/i18n';
import type { ja } from './ja';

export const en: Messages<typeof ja> = {
  summary: 'Skills',
  emptyTitle: 'No skills yet',
  emptyBody:
    'Write a guide to specialist knowledge in Markdown, or add one from the built-in skills or your skill folders. The agent reads it before answering when consulted.',
  writeSkill: 'Write a skill',
  addBuiltin: 'Add built-in skill',
  addLibrary: 'Add from library',
  editSkill: 'Edit {name}',
  newSkill: 'New skill',
  nameLabel: 'Name',
  nameHint: '{rule}. Example: code-review',
  descriptionLabel: 'Description',
  descriptionHint: 'Describe when to use this skill. Agents read this to decide whether to open it.',
  bodyLabel: 'Body (SKILL.md)',
  bodyHint: 'Write steps and points to check in Markdown.',
  cancel: 'Cancel',
  saving: 'Saving…',
  save: 'Save',
  saved: 'Skill saved',
  nameDuplicate: 'A skill with that name already exists',
  viewBody: 'View the body of {name}',
  openSkillFolder: 'Open the folder of {name}',
  detachSkill: 'Remove {name}',
  deleteSkill: 'Delete {name}',
  bodyOf: 'Body of {name}',
  viewerLinked:
    'This skill refers to the original folder {path} and is reread on every run. To change it, edit the original SKILL.md.',
  viewerBuiltin:
    'This is a built-in skill that ships with the app and is updated with it. To customize it, remove it, then bring it in with “Add copy” under “Add built-in skill”.',
  noBody: '(No body)',
  openFolder: 'Open folder',
  close: 'Close',
  markLinked: 'Link',
  markBuiltin: 'Built-in',
  detached: 'Skill removed',
  deleted: 'Skill deleted',
  detachTitle: 'Remove {name}?',
  deleteTitle: 'Delete {name}?',
  detachBuiltinMessage:
    'Removes the built-in skill from this agent. You can add it again later from “Add built-in skill”.',
  detachLinkedMessage: 'Removes the link from this agent. The original folder and SKILL.md are kept.',
  deleteMessage: 'The skill’s content will be deleted. This can’t be undone.',
  detachConfirm: 'Remove',
  deleteConfirm: 'Delete',
};
