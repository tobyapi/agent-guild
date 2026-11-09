import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { BackendError } from '../types.ts';
import { ASSET_LIMITS, AssetBudget, assetTarget, planAssets } from './assets.ts';

const temporary: string[] = [];
afterEach(() => {
  for (const dir of temporary.splice(0)) rmSync(dir, { recursive: true, force: true });
});
/** files は { 相対パス: 内容 }。作ったフォルダのパスを返す */
function library(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), 'guild-library-'));
  temporary.push(root);
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  }
  return root;
}
const plannedFiles = async (root: string, budget = new AssetBudget()): Promise<string[]> =>
  (await planAssets(root, 'skill', budget)).files.map((file) => file.split(/[\\/]/).join('/'));

describe('planAssets', () => {
  it('付属ファイルを入れ子まで拾い、SKILL.md・.git・node_modules は除く', async () => {
    const root = library({
      'SKILL.md': '元の SKILL.md',
      'scripts/run.sh': 'echo',
      'references/deep/note.md': '# note',
      '.git/config': '[core]',
      'node_modules/pkg/index.js': '',
      'scripts/node_modules/x.js': '',
      'references/SKILL.md': '入れ子の SKILL.md は付属ファイル',
      '.hidden-but-copied': 'x',
    });
    expect(await plannedFiles(root)).toEqual([
      '.hidden-but-copied',
      'references/SKILL.md',
      'references/deep/note.md',
      'scripts/run.sh',
    ]);
  });

  it('シンボリックリンク（Windows ではジャンクション）はたどらない', async () => {
    const outside = library({ 'secret.txt': '外のファイル' });
    const root = library({ 'scripts/run.sh': 'echo' });
    symlinkSync(outside, join(root, 'linked'), 'junction');
    expect(await plannedFiles(root)).toEqual(['scripts/run.sh']);
  });

  it('枠はスキルをまたいで共有し、ファイル数かバイト数が上限を超えたら bad_request', async () => {
    const first = library({ 'a.txt': '12345' });
    const second = library({ 'b.txt': '12345', 'c.txt': '1' });
    const byCount = new AssetBudget({ maxFiles: 2, maxBytes: 1024 });
    await planAssets(first, 'first', byCount);
    await expect(planAssets(second, 'second', byCount)).rejects.toThrow(/second.*上限/);
    const bySize = new AssetBudget({ maxFiles: 10, maxBytes: 10 });
    await planAssets(first, 'first', bySize);
    await expect(planAssets(second, 'second', bySize)).rejects.toMatchObject({ code: 'bad_request' });
  });

  it('既定の上限は合計 50MB・2000 ファイル', () => {
    expect(ASSET_LIMITS).toEqual({ maxFiles: 2000, maxBytes: 50 * 1024 * 1024 });
  });

  it('フォルダが無い・相対パス・ファイルなら bad_request', async () => {
    const root = library({ 'file.txt': 'x' });
    for (const dir of [join(root, 'missing'), 'relative/skill', join(root, 'file.txt')]) {
      await expect(planAssets(dir, 'skill', new AssetBudget())).rejects.toMatchObject({ code: 'bad_request' });
    }
  });
});

describe('assetTarget', () => {
  const target = join(tmpdir(), 'state', 'skills', 'unity');

  it('展開先の中ならそのパス', () => {
    expect(assetTarget(target, join('scripts', 'run.sh'))).toBe(join(target, 'scripts', 'run.sh'));
  });

  it.each([join('..', 'escape.txt'), join('scripts', '..', '..', 'escape.txt'), '.', join(tmpdir(), 'abs.txt')])(
    '展開先の外・展開先そのもの・絶対パス（%s）は bad_request',
    (relative) => {
      expect(() => assetTarget(target, relative)).toThrow(BackendError);
    },
  );
});
