import { useEffect } from 'react';
import { reportError } from '@/shared/ui';
import type { Skill } from '@/shared/types/domain';
import { loadSkills, useSkillsStore } from '../store';

/** エージェントのスキル。初めて使うときに取得する（取得前は undefined） */
export function useAgentSkills(agentId: string): Skill[] | undefined {
  const skills = useSkillsStore((state) => state.byAgent[agentId]);
  useEffect(() => {
    loadSkills(agentId).catch(reportError);
  }, [agentId]);
  return skills;
}
