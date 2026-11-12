// サイドバーとメンバーパネルの区分: 先頭のタグごと（docs/design.md §2）。
import { currentLanguage } from '@/shared/i18n';
import type { Agent, AgentTemplate, TemplateAccent } from '@/shared/types/domain';
import { tBrain } from '../i18n/brain';
import { primaryTag, tagKey, templateOfTag } from './accent';

/** タグなしの区分の見出し（いまの言語） */
export function untaggedLabel(): string {
  return tBrain('untagged');
}

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

/** エージェントのいる区分だけを、テンプレートの順 → ほかのタグはいまの言語の照合順（日本語なら五十音）→ タグなし の順に返す。エージェントは作成順のまま */
export function groupByPrimaryTag(agents: readonly Agent[], templates: readonly AgentTemplate[]): TagGroup[] {
  const groups = new Map<string, TagGroup>();
  for (const template of templates) {
    const head = template.defaults.tags[0];
    if (head === undefined || groups.has(tagKey(head))) continue;
    groups.set(tagKey(head), { key: tagKey(head), label: head, accent: template.accent, template, agents: [] });
  }
  const collator = new Intl.Collator(currentLanguage());
  const templateCount = groups.size;
  const untagged: Agent[] = [];
  for (const agent of agents) {
    const tag = primaryTag(agent);
    if (tag === null) {
      untagged.push(agent);
      continue;
    }
    // 役割のタグはどの言語の表記でもその役割の区分へ。テンプレートに一致しないタグは中立の色
    const key = tagKey(templateOfTag(templates, tag)?.defaults.tags[0] ?? tag);
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
  return [...ordered, { key: null, label: untaggedLabel(), accent: null, template: null, agents: untagged }];
}
