import { useMemo } from 'react';
import { useAllAgents, useTemplates } from '@/features/agents';
import { useProfile } from '@/features/profile';
import { useLanguage } from '@/shared/i18n';
import { mentionChipTargets } from '../model/chipTargets';
import { createMarkdownRenderer } from '../model/markdown';
import { sanitizeHtml } from '../model/sanitize';

/** 本文を表示用の安全な HTML にする関数（メンションのチップの色は mentionChipTargets が決める） */
export function useMessageRenderer(): (content: string) => string {
  const agents = useAllAgents();
  const templates = useTemplates();
  const me = useProfile();
  // 削除済みのチップ・画像のリンクの文言が HTML に入るので、言語が変わったら作り直す
  const language = useLanguage();
  return useMemo(() => {
    const render = createMarkdownRenderer(mentionChipTargets(agents, templates, { name: me.name }));
    return (content: string) => sanitizeHtml(render(content));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- language は文言を引き直すためだけに入れる
  }, [agents, templates, me.name, language]);
}
