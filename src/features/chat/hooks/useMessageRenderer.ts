import { useMemo } from 'react';
import { useAllAgents, useTemplates } from '@/features/agents';
import { useProfile } from '@/features/profile';
import { mentionChipTargets } from '../model/chipTargets';
import { createMarkdownRenderer } from '../model/markdown';
import { sanitizeHtml } from '../model/sanitize';

/** 本文を表示用の安全な HTML にする関数（メンションのチップの色は mentionChipTargets が決める） */
export function useMessageRenderer(): (content: string) => string {
  const agents = useAllAgents();
  const templates = useTemplates();
  const me = useProfile();
  return useMemo(() => {
    const render = createMarkdownRenderer(mentionChipTargets(agents, templates, { name: me.name }));
    return (content: string) => sanitizeHtml(render(content));
  }, [agents, templates, me.name]);
}
