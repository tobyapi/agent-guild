import { describe, expect, it } from 'vitest';
import { globEscapeReason, strayPathField, toolPath, unsafePathForm } from './tool-paths.ts';

describe('toolPath / strayPathField', () => {
  it('道具が実際に使う項目だけを見る', () => {
    expect(toolPath('Read', { file_path: '/a', path: '/b' })).toBe('/a');
    expect(toolPath('Grep', { file_path: '/a', path: '/b' })).toBe('/b');
    expect(toolPath('NotebookEdit', { notebook_path: '/n.ipynb' })).toBe('/n.ipynb');
    expect(toolPath('Glob', { pattern: '*' })).toBeUndefined();
    expect(toolPath('Grep', { path: '' })).toBeUndefined();
  });

  it('使わない項目にパスが入っていたら、その項目名を返す', () => {
    expect(strayPathField('Grep', { file_path: '/work/a', path: '/home/me/.ssh' })).toBe('file_path');
    expect(strayPathField('Read', { file_path: '/work/a', path: '/home/me/.ssh' })).toBe('path');
    expect(strayPathField('Write', { file_path: '/work/a', notebook_path: '/x' })).toBe('notebook_path');
    expect(strayPathField('Read', { file_path: '/work/a', path: '' })).toBeNull();
    expect(strayPathField('Grep', { pattern: 'x', path: '/work' })).toBeNull();
    expect(strayPathField('WebSearch', { path: '/x', file_path: '/y' })).toBeNull();
  });
});

describe('unsafePathForm', () => {
  it('Windows のネットワークパス・デバイスパス・代替データストリームを拒否する', () => {
    const roots = ['C:\\data\\agents\\a1\\work'];
    expect(unsafePathForm('\\\\attacker.example\\share\\x.txt', roots, 'win32')).toContain('ネットワークパス');
    expect(unsafePathForm('\\\\?\\C:\\Users\\me\\.ssh\\id_rsa', roots, 'win32')).toContain('デバイスパス');
    expect(unsafePathForm('\\\\.\\COM1', roots, 'win32')).not.toBeNull();
    expect(unsafePathForm('//attacker.example/share/x.txt', roots, 'win32')).not.toBeNull();
    expect(unsafePathForm('C:\\projects\\key.pem::$DATA', roots, 'win32')).toContain('代替データストリーム');
    expect(unsafePathForm('C:\\projects\\notes.txt:hidden', roots, 'win32')).not.toBeNull();
  });

  it('普通のパスは通し、Windows 以外では何もしない', () => {
    expect(unsafePathForm('C:\\projects\\app\\README.md', [], 'win32')).toBeNull();
    expect(unsafePathForm('D:\\x', [], 'win32')).toBeNull();
    expect(unsafePathForm('//server/share/x', [], 'linux')).toBeNull();
    expect(unsafePathForm('/tmp/a:b', [], 'darwin')).toBeNull();
  });

  it.runIf(process.platform === 'win32')('作業場所そのものがネットワーク上にあるなら、その中は通す', () => {
    const roots = ['\\\\nas\\guild\\agents\\a1\\work'];
    expect(unsafePathForm('\\\\nas\\guild\\agents\\a1\\work\\report.md', roots)).toBeNull();
    expect(unsafePathForm('\\\\nas\\guild\\agents\\a2\\work\\report.md', roots)).not.toBeNull();
  });
});

describe('globEscapeReason', () => {
  it.each(['**/*.ts', '*.{ts,tsx}', 'src/**/*.{test,spec}.ts', '{src,lib}/**', '.github/**', '*.d.ts'])(
    '普通の相対 pattern は通す: %s',
    (pattern) => {
      expect(globEscapeReason(pattern)).toBeNull();
    },
  );

  it.each(['/etc/*', '../../*', 'src/../../secret/*', '..', 'a/..\\..\\b'])('起点の外へ出る pattern: %s', (pattern) => {
    expect(globEscapeReason(pattern)).not.toBeNull();
  });

  it.each(['{.,x}{.,x}/*', '.{,x}./*', '{/etc,x}/passwd', '{C:,x}/Users/*', '{~,x}/.ssh/*', '{a,{b/c}}/*'])(
    '波括弧の展開で外を指せる pattern: %s',
    (pattern) => {
      expect(globEscapeReason(pattern)).not.toBeNull();
    },
  );

  it('Windows ではドライブ名つきの相対 pattern も拒否する', () => {
    expect(globEscapeReason('D:secret/*', 'win32')).toContain('絶対パス');
    expect(globEscapeReason('C:\\Users\\*', 'win32')).toContain('絶対パス');
  });

  it('pattern が文字列でなければ判定しない（道具の側が弾く）', () => {
    expect(globEscapeReason(undefined)).toBeNull();
  });
});
