// 権限のトグルの表示（docs/ui-design.md §6.3）。実効権限と権限の規則の判定は shared/lib/permissions（モックと共有）。
import { PERMISSION_LABELS, PERMISSION_ORDER } from '@/shared/lib/permissions';
import type { PermissionKey, Permissions } from '@/shared/types/domain';

export {
  effectivePermissions,
  leakRisk,
  PERMISSION_LABELS,
  PERMISSION_ORDER,
  permissionRuleProblem,
} from '@/shared/lib/permissions';
export type { RuleProblem } from '@/shared/lib/permissions';

export interface PermissionText {
  label: string;
  description: string;
  /** オンにしたときに出す注意書き（空なら出さない。あれば行全体を注意の姿にする） */
  warning: string;
}

/** docs/ui-design.md §6.3 の表 */
const DESCRIPTIONS: Readonly<Record<PermissionKey, string>> = {
  webSearch: 'Web を検索して、最新の情報を探します。',
  webFetch: 'URL を開いて、ページの中身を読みます。',
  readFiles: '作業フォルダ（と相談元の作業フォルダ）のファイルを読みます。',
  writeFiles: '作業フォルダにファイルを作り、書き換えます。',
  writeAnywhere:
    'このパソコンのどこのファイルでも読み書きします。「コマンドを実行」も許せば、PATH などの Windows の設定も変えられます。ソフトのインストールや、ほかのフォルダにあるプロジェクトの作業に使います。',
  runCommands: '作業フォルダで npm や git などのコマンドを実行できるようにします。',
  skills: '登録したスキル（手引き）を読んでから答えます。',
};

const WARNINGS: Partial<Record<PermissionKey, string>> = {
  writeAnywhere:
    'このパソコンのどのファイルでも書き換えや削除ができるようになります。Windows やほかのアプリの設定、このギルドのデータも例外ではないため、任せられる役割のエージェントにだけ許可してください。',
  runCommands:
    'コマンドはこのパソコンの上で、あなたと同じ権限で動きます。ファイルの削除や外部への送信もできてしまうため、任せられる役割のエージェントにだけ許可してください。',
};

/** 権限のトグルの文言 */
export function permissionText(key: PermissionKey): PermissionText {
  return { label: PERMISSION_LABELS[key], description: DESCRIPTIONS[key], warning: WARNINGS[key] ?? '' };
}

/** 注意書きのある権限のうち、許可しているもの（プレビューの札に出す） */
export function riskyGrants(permissions: Permissions): PermissionKey[] {
  return PERMISSION_ORDER.filter((key) => permissions[key] && permissionText(key).warning !== '');
}
