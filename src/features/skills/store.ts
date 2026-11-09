// スキル（エージェントごと）。開いたエージェントの分だけ取得し、skills-changed で取り直す。
import { create } from 'zustand';
import { reportError } from '@/shared/ui';
import type { LibraryAddMode, Skill, SkillInput } from '@/shared/types/domain';
import { skillsApi } from './api';

interface SkillsStoreState {
  /** agentId → スキル（名前順）。まだ取得していないエージェントはキーがない */
  byAgent: Record<string, Skill[]>;
}

export const useSkillsStore = create<SkillsStoreState>()(() => ({ byAgent: {} }));

function put(agentId: string, skills: Skill[]): void {
  const sorted = [...skills].sort((a, b) => a.name.localeCompare(b.name));
  useSkillsStore.setState((state) => ({ byAgent: { ...state.byAgent, [agentId]: sorted } }));
}

export async function loadSkills(agentId: string): Promise<void> {
  put(agentId, await skillsApi.list(agentId));
}

/** skills-changed: 取得済みのエージェントだけ取り直す */
export function reloadSkillsIfLoaded(agentId: string): void {
  if (agentId in useSkillsStore.getState().byAgent) loadSkills(agentId).catch(reportError);
}

function upsert(saved: Skill): Skill {
  const current = useSkillsStore.getState().byAgent[saved.agentId] ?? [];
  put(saved.agentId, [...current.filter((skill) => skill.id !== saved.id), saved]);
  return saved;
}

export async function saveSkill(input: SkillInput): Promise<Skill> {
  return upsert(await skillsApi.save(input));
}

/** ライブラリのスキルをエージェントに付ける（link: 参照して実行のたびに読み直す / copy: 取り込む） */
export async function addLibrarySkill(agentId: string, path: string, mode: LibraryAddMode): Promise<Skill> {
  return upsert(await skillsApi.addFromLibrary(agentId, path, mode));
}

/** リンク先・ライブラリのフォルダを OS のファイラで開く */
export async function revealSkillFolder(path: string): Promise<void> {
  await skillsApi.revealFolder(path);
}

export async function deleteSkill(skill: Skill): Promise<void> {
  await skillsApi.remove(skill.id);
  const current = useSkillsStore.getState().byAgent[skill.agentId] ?? [];
  put(skill.agentId, current.filter((candidate) => candidate.id !== skill.id));
}
