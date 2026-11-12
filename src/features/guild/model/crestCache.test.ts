import { describe, expect, it } from 'vitest';
import { DEFAULT_GUILD } from '@/shared/lib/guild';
import { parseStoredCrest } from './crestCache';

describe('parseStoredCrest', () => {
  it('覚えていた紋を読む', () => {
    expect(parseStoredCrest('{"shape":"star","color":"jade"}')).toEqual({ shape: 'star', color: 'jade' });
  });

  it('なければ・壊れていれば既定の菱', () => {
    expect(parseStoredCrest(null)).toEqual(DEFAULT_GUILD.crest);
    expect(parseStoredCrest('{壊れた')).toEqual(DEFAULT_GUILD.crest);
    expect(parseStoredCrest('"star"')).toEqual(DEFAULT_GUILD.crest);
  });

  it('知らない形や色は、その項目だけ既定にする', () => {
    expect(parseStoredCrest('{"shape":"dragon","color":"violet"}')).toEqual({ shape: 'diamond', color: 'violet' });
    expect(parseStoredCrest('{"shape":"shield"}')).toEqual({ shape: 'shield', color: 'default' });
  });
});
