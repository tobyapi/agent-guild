// スキルライブラリ（docs/design.md §14）: フォルダの指定・走査・エージェントへの追加・フォルダを開く。
import { isInsidePath, isSamePath } from '@/shared/lib/paths';
import type { Skill } from '@/shared/types/domain';
import { findSkillFolder, folderExists, scanLibrary, skillMdProblem } from '../library';
import { fail, requireAgent } from '../runtime';
import type { HandlerGroup } from './types';

type LibraryCommands = 'get_skill_library' | 'set_skill_library_dirs' | 'add_library_skill' | 'reveal_skill_folder';

const ABSOLUTE_PATH = /^(?:[a-z]:\\|\\\\|\/)/i;

/** 絶対パスで、重複も入れ子もないこと（違反は validation） */
function checkDirs(dirs: readonly string[]): void {
  for (const [index, dir] of dirs.entries()) {
    if (!ABSOLUTE_PATH.test(dir)) fail('validation', `絶対パスのフォルダを指定してください（${dir}）`, 'dirs');
    const others = dirs.filter((_, position) => position !== index);
    if (others.some((other) => isSamePath(other, dir))) fail('validation', `同じフォルダが2回指定されています（${dir}）`, 'dirs');
    const parent = others.find((other) => isInsidePath(dir, other));
    if (parent) fail('validation', `${dir} は ${parent} の中にあります。どちらか一方だけを指定してください`, 'dirs');
  }
}

export const skillLibraryHandlers: HandlerGroup<LibraryCommands> = {
  get_skill_library: (_args, runtime) => scanLibrary(runtime.state.skillLibraryDirs),

  set_skill_library_dirs({ dirs }, runtime) {
    const trimmed = dirs.map((dir) => dir.trim());
    checkDirs(trimmed);
    runtime.state.skillLibraryDirs = trimmed;
    runtime.bus.emit('skill-library-changed', null);
    return scanLibrary(trimmed);
  },

  add_library_skill({ agentId, path, mode }, runtime) {
    requireAgent(runtime, agentId);
    const found = findSkillFolder(path) ?? fail('not_found', `スキルのフォルダが見つかりません（${path}）`);
    const problem = skillMdProblem(found);
    if (problem) fail('validation', problem);
    if (runtime.state.skills.some((skill) => skill.agentId === agentId && skill.name === found.name)) {
      fail('conflict', `スキル「${found.name}」はすでにあります`);
    }
    const skill: Skill = {
      id: runtime.env.newId(),
      agentId,
      name: found.name,
      description: found.description,
      body: found.body,
      source: mode === 'link' ? { kind: 'linked', path: found.path } : null,
      problem: null,
      updatedAt: runtime.env.now(),
    };
    runtime.state.skills.push(skill);
    runtime.bus.emit('skills-changed', { agentId });
    return skill;
  },

  reveal_skill_folder({ path }) {
    if (!folderExists(path)) fail('not_found', `フォルダが見つかりません（${path}）`);
    return null;
  },
};
