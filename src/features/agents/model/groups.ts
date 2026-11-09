// サイドバーとメンバーパネルの区分: 先頭のタグごと（docs/design.md §2）。
import type { Agent, AgentTemplate, TemplateAccent } from '@/shared/types/domain';
import { primaryTag, tagKey } from './accent';

export const UNTAGGED_LABEL = 'タグなし';

export interface TagGroup {
  /** 区分のキー（正規化した先頭のタグ。タグなしは null） */
  key: string | null;
  /** 見出し。テンプレートの区分はテンプレートの先頭のタグ、ほかは最初に見つかった表記 */
  label: string;
  accent: TemplateAccent;
  /** この区分のタグを先頭に持つテンプレート（「＋」で作成するときに使う） */
  template: AgentTemplate | null;
  /** 作成順。空の区分は返さない */
  agents: Agent[];
}

const collator = new Intl.Collator('ja');

/** エージェントのいる区分だけを、テンプレートの順 → ほかのタグは五十音 → タグなし の順に返す。エージェントは作成順のまま */
export function groupByPrimaryTag(agents: readonly Agent[], templates: readonly AgentTemplate[]): TagGroup[] {
  const groups = new Map<string, TagGroup>();
  for (const template of templates) {
    const head = template.defaults.tags[0];
    if (head === undefined || groups.has(tagKey(head))) continue;
    groups.set(tagKey(head), { key: tagKey(head), label: head, accent: template.accent, template, agents: [] });
  }
  const templateCount = groups.size;
  const untagged: Agent[] = [];
  for (const agent of agents) {
    const tag = primaryTag(agent);
    if (tag === null) {
      untagged.push(agent);
      continue;
    }
    const key = tagKey(tag);
    // テンプレートの先頭のタグに一致しないタグは中立の色
    const group = groups.get(key) ?? { key, label: tag, accent: null, template: null, agents: [] };
    group.agents.push(agent);
    groups.set(key, group);
  }
  const all = [...groups.values()];
  const [templateGroups, tagGroups] = [all.slice(0, templateCount), all.slice(templateCount)];
  const ordered = [
    ...templateGroups.filter((group) => group.agents.length > 0),
    ...tagGroups.sort((a, b) => collator.compare(a.label, b.label)),
  ];
  if (untagged.length === 0) return ordered;
  return [...ordered, { key: null, label: UNTAGGED_LABEL, accent: null, template: null, agents: untagged }];
}
