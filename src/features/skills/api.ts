import { invoke } from '@/shared/api';
import type { LibraryAddMode, SkillInput } from '@/shared/types/domain';

export const skillsApi = {
  list: (agentId: string) => invoke('list_skills', { agentId }),
  save: (input: SkillInput) => invoke('save_skill', { input }),
  remove: (id: string) => invoke('delete_skill', { id }),
  builtins: () => invoke('list_builtin_skills'),
  addBuiltin: (agentId: string, name: string, mode: LibraryAddMode) =>
    invoke('add_builtin_skill', { agentId, name, mode }),
  library: () => invoke('get_skill_library'),
  setLibraryDirs: (dirs: string[]) => invoke('set_skill_library_dirs', { dirs }),
  addFromLibrary: (agentId: string, path: string, mode: LibraryAddMode) =>
    invoke('add_library_skill', { agentId, path, mode }),
  revealFolder: (path: string) => invoke('reveal_skill_folder', { path }),
  chooseFolder: () => invoke('choose_folder'),
};
