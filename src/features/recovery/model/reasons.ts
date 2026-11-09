// 復旧画面の文言とおすすめの行動（docs/ui-design.md §6.5）。
import type { BootReason } from '@/shared/types/domain';

export type RecoveryAction = 'retry' | 'choose' | 'useDefault';
export type FailureReason = Exclude<BootReason, 'none'>;

interface ReasonCopy {
  title: string;
  description: string;
  recommended: RecoveryAction;
}

const COPIES: Readonly<Record<FailureReason, ReasonCopy>> = {
  missing: {
    title: 'データフォルダが見つかりません',
    description:
      '設定されている場所にアクセスできません。外付けドライブやネットワーク上の場所なら、つないでから再試行してください。',
    recommended: 'retry',
  },
  locked: {
    title: 'AIギルドがすでに起動しています',
    description: '同じデータフォルダを使う AIギルドがもう 1 つ動いています。そちらを閉じてから再試行してください。',
    recommended: 'retry',
  },
  newer_version: {
    title: '新しい版のデータです',
    description:
      'このフォルダは、より新しい AIギルドで保存されています。データを守るため、この版では開きません。アプリを更新するか、別のフォルダを選んでください。',
    recommended: 'choose',
  },
  foreign: {
    title: 'AIギルドのデータフォルダではありません',
    description:
      'このフォルダには AIギルド以外のファイルがあります。大事なファイルを守るため、このフォルダは使いません。',
    recommended: 'choose',
  },
  corrupt: {
    title: 'データを読み込めませんでした',
    description: 'データベースが壊れている可能性があります。元のファイルには手を加えていません。',
    recommended: 'useDefault',
  },
  not_writable: {
    title: 'このフォルダに書き込めません',
    description: '書き込む権限がありません。フォルダの権限を確かめるか、別のフォルダを選んでください。',
    recommended: 'choose',
  },
};

const FALLBACK: ReasonCopy = { title: 'データフォルダを開けませんでした', description: '', recommended: 'retry' };

export function reasonCopy(reason: BootReason): ReasonCopy {
  return reason === 'none' ? FALLBACK : COPIES[reason];
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
