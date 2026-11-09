import { describe, expect, it } from 'vitest';
import type { StorageInfo } from '@/shared/types/domain';
import { changingLabel, DATA_DIR_MODE_OPTIONS, storageSourceText } from './storage';

const storage = (source: StorageInfo['source']): StorageInfo => ({
  dataDir: 'D:\\GuildData',
  defaultDataDir: 'C:\\Users\\me\\AppData\\Local\\guild',
  source,
});

describe('storageSourceText', () => {
  it('保存先の決まり方を説明する（設定なら既定の場所も添える）', () => {
    expect(storageSourceText(storage('default'))).toBe('既定の場所です。');
    expect(storageSourceText(storage('settings'))).toContain('C:\\Users\\me\\AppData\\Local\\guild');
    expect(storageSourceText(storage('env'))).toContain('変更できません');
  });
});

describe('DATA_DIR_MODE_OPTIONS / changingLabel', () => {
  it('copy と open の2つを、copy から並べる', () => {
    expect(DATA_DIR_MODE_OPTIONS.map((option) => option.value)).toEqual(['copy', 'open']);
    expect(changingLabel('copy')).toBe('データをコピーしています…');
  });
});
