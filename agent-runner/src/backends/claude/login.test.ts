import { existsSync } from 'node:fs';
import { basename } from 'node:path';
import { describe, expect, it } from 'vitest';
import { bundledClaudePath, loginArguments } from './login.ts';

describe('Claude のログイン', () => {
  it('cmd の start /wait で、claude の auth login を新しい窓に開く（パスは引用符で囲む）', () => {
    expect(loginArguments('C:\\Program Files\\AI Guild\\claude.exe')).toBe(
      '/d /s /c "start "Claude にログイン" /wait "C:\\Program Files\\AI Guild\\claude.exe" auth login"',
    );
  });

  it('SDK の OS ごとのパッケージに同梱された実行ファイルを使う', () => {
    const path = bundledClaudePath();
    expect(basename(path)).toBe(process.platform === 'win32' ? 'claude.exe' : 'claude');
    expect(existsSync(path)).toBe(true);
  });
});
