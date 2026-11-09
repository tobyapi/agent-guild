// データの保存先の表し方（docs/design.md §11）。
import type { DataDirMode, StorageInfo, StorageSource } from '@/shared/types/domain';

export interface ModeOption {
  value: DataDirMode;
  label: string;
  description: string;
}

/** 変更のしかた（ラジオカード） */
export const DATA_DIR_MODE_OPTIONS: readonly ModeOption[] = [
  {
    value: 'copy',
    label: '今のデータをコピーして使う',
    description: 'チャンネル・エージェント・会話を空のフォルダにコピーして使います。元のデータは消えません。',
  },
  {
    value: 'open',
    label: 'その場所のデータを開く',
    description: 'そのフォルダにあるギルドのデータで起動します。空のフォルダなら新しく始めます。',
  },
];

/** いまの保存先の説明 */
export function storageSourceText(storage: StorageInfo): string {
  const texts: Record<StorageSource, string> = {
    default: '既定の場所です。',
    settings: `設定で変更した場所です（既定: ${storage.defaultDataDir}）。`,
    env: '環境変数 GUILD_DATA_DIR で決まっているため、ここでは変更できません。',
  };
  return texts[storage.source];
}

/** 変更中の案内（ボタンの文言） */
export function changingLabel(mode: DataDirMode): string {
  return mode === 'copy' ? 'データをコピーしています…' : '切り替えています…';
}
