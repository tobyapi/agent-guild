import { describe, expect, it } from 'vitest';
import { loginArguments, loginCommand } from './login.ts';

describe('Claude のログイン', () => {
  it('cmd の start /wait で、claude の auth login を新しい窓に開く（パスは引用符で囲む）', () => {
    expect(loginArguments(['C:\\Program Files\\AI Guild\\claude.exe'])).toBe(
      '/d /s /c "start "Claude にログイン" /wait "C:\\Program Files\\AI Guild\\claude.exe" auth login"',
    );
  });

  it('実行ファイルはそのまま、npm の cli.js は node で動かす', () => {
    expect(loginCommand('C:\\Users\\me\\.local\\bin\\claude.exe', 'C:\\node\\node.exe')).toEqual([
      'C:\\Users\\me\\.local\\bin\\claude.exe',
    ]);
    expect(loginCommand('C:\\npm\\node_modules\\@anthropic-ai\\claude-code\\cli.js', 'C:\\node\\node.exe')).toEqual([
      'C:\\node\\node.exe',
      'C:\\npm\\node_modules\\@anthropic-ai\\claude-code\\cli.js',
    ]);
    expect(loginArguments(['C:\\node\\node.exe', 'C:\\npm\\cli.js'])).toBe(
      '/d /s /c "start "Claude にログイン" /wait "C:\\node\\node.exe" "C:\\npm\\cli.js" auth login"',
    );
  });
});
