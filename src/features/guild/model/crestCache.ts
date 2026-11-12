// 最後に見たギルドの紋（形と色）を localStorage に覚える。起動中・復旧の画面はスナップショットより先に出るので、
// 前回の紋で出すために使う（正は DB。ここは表示のための写しで、読めなければ既定の菱）。
import { DEFAULT_GUILD, knownCrest } from '@/shared/lib/guild';
import type { GuildCrest } from '@/shared/types/domain';

export const CREST_STORAGE_KEY = 'agent-guild.crest';

/** 保存されていた値を読む（なければ・壊れていれば・知らない形や色なら既定） */
export function parseStoredCrest(stored: string | null): GuildCrest {
  if (stored === null) return DEFAULT_GUILD.crest;
  try {
    const value: unknown = JSON.parse(stored);
    if (typeof value !== 'object' || value === null) return DEFAULT_GUILD.crest;
    const { shape, color } = value as Partial<Record<keyof GuildCrest, unknown>>;
    const crest = { shape, color } as GuildCrest;
    return knownCrest({ name: '', crest }).crest;
  } catch {
    return DEFAULT_GUILD.crest;
  }
}

export function readCachedCrest(): GuildCrest {
  try {
    return parseStoredCrest(typeof localStorage === 'undefined' ? null : localStorage.getItem(CREST_STORAGE_KEY));
  } catch {
    return DEFAULT_GUILD.crest;
  }
}

export function writeCachedCrest(crest: GuildCrest): void {
  try {
    localStorage.setItem(CREST_STORAGE_KEY, JSON.stringify(crest));
  } catch {
    // 覚えられなくても、次の起動中の画面が既定の紋になるだけ
  }
}
