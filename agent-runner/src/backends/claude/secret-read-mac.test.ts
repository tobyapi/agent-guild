// macOS のデータボリュームの別名（/System/Volumes/Data/...）で書いた秘密の場所も、除外に当たることを確かめる。
import { stat } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { fileAccessPolicy } from './permissions.ts';
import { withoutDataVolume } from './secret-read.ts';
import { home, outside, request, call, read } from './secret-read.test-support.ts';

vi.mock('node:os', async (original) => ({ ...(await original<typeof import('node:os')>()), homedir: () => home }));

const DATA = '/System/Volumes/Data';

describe('withoutDataVolume', () => {
  it('データボリュームの別名を外し、ほかのパスはそのままにする', () => {
    expect(withoutDataVolume('/System/Volumes/Data/Users/me/.aws/credentials')).toBe('/Users/me/.aws/credentials');
    expect(withoutDataVolume('/system/volumes/data/Users/me')).toBe('/Users/me');
    expect(withoutDataVolume('/System/Volumes/Data')).toBe('/');
    expect(withoutDataVolume('/System/Volumes/Database/x')).toBe('/System/Volumes/Database/x');
    expect(withoutDataVolume('/Users/me/System/Volumes/Data/x')).toBe('/Users/me/System/Volumes/Data/x');
  });
});

describe.skipIf(process.platform !== 'darwin')('readAnywhere の秘密の場所の除外（macOS の別名）', () => {
  it.each(['.aws/credentials', '.netrc', '.claude/.credentials.json', 'Library/Keychains/login.keychain-db'])(
    '別名で書いた %s は読めない',
    async (name) => {
      expect(await read(join(DATA, home, name))).toMatchObject({ behavior: 'deny' });
    },
  );

  it('別名で書いた秘密の場所は、検索の起点にもできない', async () => {
    const policy = fileAccessPolicy(request());
    const input = { path: join(DATA, home, '.ssh'), pattern: 'fixture-secret' };
    expect(await call(policy, 'Grep', input)).toMatchObject({ behavior: 'deny' });
    expect(await call(policy, 'Glob', { path: join(DATA, home), pattern: '*' })).toMatchObject({ behavior: 'deny' });
  });

  it('別名で書いても、秘密ではない場所は読める', async () => {
    expect(await read(join(DATA, outside, 'README.md'))).toMatchObject({ behavior: 'allow' });
  });

  it('inode で開くパス（/.vol/...）は、解決できないので読めない', async () => {
    const { dev, ino } = await stat(join(home, '.aws/credentials'));
    expect(await read(`/.vol/${dev}/${ino}`)).toMatchObject({ behavior: 'deny' });
  });
});
