import { useMemo } from 'react';
import { useAllAgents } from '@/features/agents';
import { useProfile } from '@/features/profile';
import { createAuthorResolver } from '../model/authors';
import type { AuthorView } from '../model/authors';

/** 発言者 ID → 表示（削除済みのエージェントも名前で出す） */
export function useAuthorResolver(): (authorId: string) => AuthorView {
  const agents = useAllAgents();
  const me = useProfile();
  return useMemo(() => createAuthorResolver(agents, me), [agents, me]);
}

/** システム発言で強調する名前（削除済みも含むエージェントと自分） */
export function useKnownNames(): string[] {
  const agents = useAllAgents();
  const me = useProfile();
  return useMemo(() => [...agents.map((agent) => agent.name), me.name], [agents, me.name]);
}
