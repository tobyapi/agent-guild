// 振る舞いの要約（エージェント編集のプレビューに出す中立の線の札。docs/ui-design.md §5.11）。
import type { Agent } from '@/shared/types/domain';
import { tBrain } from '../i18n/brain';

type BehaviorSettings = Pick<Agent, 'unmentioned' | 'consultable' | 'canDelegate' | 'autonomyEnabled'>;

/** 当てはまるものを「最初に受ける」「相談相手」「割り振り」「自分から動く」の順で返す */
export function behaviorSummary(settings: BehaviorSettings): string[] {
  const entries: Array<[boolean, string]> = [
    [settings.unmentioned === 'lead', tBrain('summaryLead')],
    [settings.consultable, tBrain('summaryConsultable')],
    [settings.canDelegate, tBrain('summaryDelegate')],
    [settings.autonomyEnabled, tBrain('summaryAutonomy')],
  ];
  return entries.filter(([applies]) => applies).map(([, label]) => label);
}
