// 見た目の区分: タグの色（そのタグを先頭に持つテンプレートの accent）と人間の印。
// 振る舞いはタグやテンプレートで変えない（docs/design.md §2）。色を決めるのはここだけ。
import { normalizeName } from '@/shared/lib/names';
import type { Agent, AgentTemplate, TemplateAccent } from '@/shared/types/domain';

/** 印・チップで人間を表す色の名前（トークン --kind-human） */
export const HUMAN_ACCENT = 'human';

/** 札・印・チップの色の名前（トークン --kind-<名前>。テンプレートの accent か HUMAN_ACCENT）。null は中立 */
export type MemberAccent = TemplateAccent;

/** タグの同一視に使うキー（NFKC＋大文字小文字無視。サーバの重複の判定と同じ） */
export function tagKey(tag: string): string {
  return normalizeName(tag);
}

/** 先頭のタグ（サイドバーの区分と札に使う）。タグがなければ null */
export function primaryTag(agent: Pick<Agent, 'tags'>): string | null {
  return agent.tags[0] ?? null;
}

/** そのタグを先頭に持つテンプレート（なければ undefined） */
export function templateOfTag(templates: readonly AgentTemplate[], tag: string): AgentTemplate | undefined {
  const key = tagKey(tag);
  return templates.find((template) => {
    const head = template.defaults.tags[0];
    return head !== undefined && tagKey(head) === key;
  });
}

/** タグの色: そのタグを先頭に持つテンプレートの accent（タグがない・一致しなければ null = 中立） */
export function tagAccent(templates: readonly AgentTemplate[], tag: string | null): TemplateAccent {
  if (tag === null) return null;
  return templateOfTag(templates, tag)?.accent ?? null;
}

/** エージェントの色: 先頭のタグの色 */
export function agentAccent(templates: readonly AgentTemplate[], agent: Pick<Agent, 'tags'>): TemplateAccent {
  return tagAccent(templates, primaryTag(agent));
}
