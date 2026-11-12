// データの保存先の表し方（docs/design.md §11）。
import type { DataDirMode, StorageInfo, StorageSource } from '@/shared/types/domain';
import { tStorage as t } from '../i18n/storage';

export interface ModeOption {
  value: DataDirMode;
  label: string;
  description: string;
}

/** 変更のしかた（ラジオカード。いまの言語で描画のたびに作る） */
export function dataDirModeOptions(): readonly ModeOption[] {
  return [
    { value: 'copy', label: t('modeCopyLabel'), description: t('modeCopyDescription') },
    { value: 'open', label: t('modeOpenLabel'), description: t('modeOpenDescription') },
  ];
}

/** いまの保存先の説明 */
export function storageSourceText(storage: StorageInfo): string {
  const texts: Record<StorageSource, string> = {
    default: t('sourceDefault'),
    settings: t('sourceSettings', { dir: storage.defaultDataDir }),
    env: t('sourceEnv'),
  };
  return texts[storage.source];
}

/** 変更中の案内（ボタンの文言） */
export function changingLabel(mode: DataDirMode): string {
  return mode === 'copy' ? t('changingCopy') : t('changingOpen');
}
