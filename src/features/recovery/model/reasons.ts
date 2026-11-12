// 復旧画面の文言とおすすめの行動（docs/ui-design.md §6.5）。
import type { BootReason } from '@/shared/types/domain';
import { t } from '../i18n';

export type RecoveryAction = 'retry' | 'choose' | 'useDefault';
export type FailureReason = Exclude<BootReason, 'none'>;

interface ReasonCopy {
  title: string;
  description: string;
  recommended: RecoveryAction;
}

type CopyKey = Parameters<typeof t>[0];

/** 理由ごとの文言のキーとおすすめ（文言は reasonCopy でいまの言語にする） */
const COPIES: Readonly<Record<FailureReason, { title: CopyKey; description: CopyKey; recommended: RecoveryAction }>> = {
  missing: { title: 'missingTitle', description: 'missingDescription', recommended: 'retry' },
  locked: { title: 'lockedTitle', description: 'lockedDescription', recommended: 'retry' },
  newer_version: { title: 'newerTitle', description: 'newerDescription', recommended: 'choose' },
  foreign: { title: 'foreignTitle', description: 'foreignDescription', recommended: 'choose' },
  corrupt: { title: 'corruptTitle', description: 'corruptDescription', recommended: 'useDefault' },
  not_writable: { title: 'notWritableTitle', description: 'notWritableDescription', recommended: 'choose' },
};

export function reasonCopy(reason: BootReason): ReasonCopy {
  if (reason === 'none') return { title: t('fallbackTitle'), description: '', recommended: 'retry' };
  const copy = COPIES[reason];
  return { title: t(copy.title), description: t(copy.description), recommended: copy.recommended };
}

/** おすすめの行動。いまの場所が既定なら「既定の場所に戻す」は使えないので「別のフォルダを選ぶ」にする */
export function recommendedAction(reason: BootReason, atDefaultLocation: boolean): RecoveryAction {
  const recommended = reasonCopy(reason).recommended;
  return recommended === 'useDefault' && atDefaultLocation ? 'choose' : recommended;
}

/** おすすめを先頭に、残りを決まった順に並べる */
export function orderedActions(recommended: RecoveryAction): RecoveryAction[] {
  const all: RecoveryAction[] = ['retry', 'choose', 'useDefault'];
  return [recommended, ...all.filter((action) => action !== recommended)];
}
