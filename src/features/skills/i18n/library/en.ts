import type { Messages } from '@/shared/i18n';
import type { ja } from './ja';

const extraFiles = (count: string | number | undefined) =>
  count === 1 ? '1 extra file' : `${String(count)} extra files`;

export const en: Messages<typeof ja> = {
  loading: 'Loading…',
  reload: 'Reload',
  builtinTitle: 'Add built-in skill',
  closeBuiltin: 'Close Add built-in skill',
  builtinHelp:
    'Guides that ship with the app. “Add” refers to the built-in skill, so its content updates with the app (it can’t be edited in the app). “Add copy” imports only the body of SKILL.md, which you can then edit in the app (extra files aren’t included).',
  builtinList: 'Built-in skills',
  libraryTitle: 'Add from library',
  closeLibrary: 'Close Add from library',
  libraryHelp:
    '“Add” refers to the original folder and rereads SKILL.md and its extra files on every run (it can’t be edited in the app). “Add copy” imports only the body of SKILL.md, which you can then edit in the app (extra files aren’t included).',
  libraryList: 'Library skills',
  noDirsTitle: 'No skill folders yet',
  noDirsBody:
    'Choose Agent Skills folders (folders containing name/SKILL.md) under “Skill folders” in Settings to add skills from here.',
  openSettings: 'Open Settings',
  noSkillsTitle: 'No skills found in the chosen folders',
  noSkillsMissingDirs: 'Some folders can’t be found. Check “Skill folders” in Settings.',
  noSkillsHint: 'Make sure the folders contain name/SKILL.md, then press “Reload”.',
  search: 'Search',
  searchPlaceholder: 'Search by name, description, or folder',
  missingDirs: ({ count }) =>
    `${count === 1 ? '1 folder' : `${String(count)} folders`} can’t be found (check “Skill folders” in Settings).`,
  noMatch: 'No skills match “{query}”.',
  added: 'Added {name}',
  copiedAdded: 'Added a copy of {name}',
  extraFiles: ({ count }) => extraFiles(count),
  noExtraFiles: 'No extra files',
  nameTaken: 'A skill named “{name}” already exists.',
  noDescription: '(No description)',
  addedMark: 'Added',
  add: 'Add',
  copyAdd: 'Add copy',
  copyTitleWithFiles: ({ count }) => `Imports only the body of SKILL.md (its ${extraFiles(count)} aren’t included)`,
  copyTitle: 'Imports the body of SKILL.md',
  sectionHelp:
    'Choose Agent Skills folders (folders containing {path}) to attach their skills to agents with “Add from library”. After changing a folder’s contents, press “Reload”.',
  skillPath: 'name/SKILL.md',
  noDirs: 'No folders chosen yet.',
  dirsLabel: 'Skill folders (listed in order)',
  addFolder: 'Add folder…',
  skillCount: ({ count }) => (count === 1 ? '1 skill' : `${String(count)} skills`),
  moveUp: 'Move {dir} up',
  moveDown: 'Move {dir} down',
  openDir: 'Open {dir}',
  removeDir: 'Remove {dir}',
  dirAlready: 'That folder is already in the list',
  dirInside: 'This folder is inside {parent}. Its skills are already found',
  dirContains: 'This folder contains {child}, which is already in the list. Remove {child} first',
};
