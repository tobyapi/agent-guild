// コマンドを閉じ込める設定の組み立て（どの OS でも動く、純粋な関数の検査）。
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, dirname, join, parse } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { isInside } from '../types.ts';
import {
  COMMAND_MAX_CHARS,
  containerConfig,
  enumerablePaths,
  homeDirs,
  powershellCommandLine,
  sandboxEnv,
  toolDirs,
  type CommandScope,
} from './policy.ts';

const root = realpathSync(mkdtempSync(join(tmpdir(), 'guild-sandbox-policy-')));
afterAll(() => rmSync(root, { recursive: true, force: true }));
const dir = (...parts: string[]): string => {
  const path = join(root, ...parts);
  mkdirSync(path, { recursive: true });
  return path;
};
const work = dir('data', 'agents', 'a1', 'work');
const peer = dir('data', 'agents', 'a0', 'work');
const home = dir('data', 'agents', 'a1', 'state', 'command-home');
const windows = dir('Windows');
const scope: CommandScope = { cwd: work, writable: [work], readable: [peer], home };

describe('toolDirs', () => {
  const git = dir('tools', 'git', 'cmd');
  const node = dir('tools', 'nodejs');
  const file = join(root, 'tools', 'not-a-dir.txt');
  writeFileSync(file, 'x');
  const env = {
    SystemRoot: windows,
    PATH: [
      join(windows, 'System32'),
      git,
      `${node}${delimiter}${node}`,
      join(root, 'missing'),
      file,
      join(work, 'bin'),
      dirname(dirname(work)),
      parse(root).root,
      '',
    ].join(delimiter),
  };

  it('PATH のうち、実在するフォルダで、Windows の外にあるものだけを足す（重複は1つに）', () => {
    expect(toolDirs(env, [work, home, peer])).toEqual([git, node]);
  });

  it('許可する範囲の中・範囲を含むフォルダ・ドライブの直下は足さない', () => {
    mkdirSync(join(work, 'bin'), { recursive: true });
    const dirs = toolDirs(env, [work, home, peer]);
    expect(dirs).not.toContain(join(work, 'bin'));
    expect(dirs).not.toContain(dirname(dirname(work)));
    expect(dirs).not.toContain(parse(root).root);
  });

  it('PATH の名前の大文字小文字が違っても読む', () => {
    expect(toolDirs({ SystemRoot: windows, Path: git }, [work])).toEqual([git]);
    expect(toolDirs({ SystemRoot: windows }, [work])).toEqual([]);
  });
});

describe('enumerablePaths', () => {
  it('許可した場所の親をドライブの直下まで挙げ、許可した場所の中は挙げない', () => {
    const nested = join(work, 'sub');
    const paths = enumerablePaths([work, nested, peer]);
    expect(paths).toContain(dirname(work));
    expect(paths).toContain(parse(work).root);
    // work は nested の親だが、work 自身が許可されているので「一覧だけ」にはしない（読み取りの許可を打ち消すため）
    expect(paths).not.toContain(work);
    expect(paths.some((path) => [work, nested, peer].some((granted) => isInside(path, granted)))).toBe(false);
  });
});

describe('sandboxEnv', () => {
  it('秘密らしい変数を除き、ホームと設定・一時ファイルの場所を専用のホームに向ける', () => {
    const env = sandboxEnv(
      {
        PATH: 'tools',
        SystemRoot: windows,
        OPENAI_API_KEY: 'secret',
        GITHUB_TOKEN: 'secret',
        UserProfile: 'C:\\Users\\me',
        AppData: 'C:\\Users\\me\\AppData\\Roaming',
        LOCALAPPDATA: 'C:\\Users\\me\\AppData\\Local',
        Temp: 'C:\\Users\\me\\AppData\\Local\\Temp',
      },
      home,
    );
    expect(env).toMatchObject({ PATH: 'tools', SystemRoot: windows, USERPROFILE: home, HOME: home });
    expect(Object.keys(env).filter((name) => /KEY|TOKEN/.test(name))).toEqual([]);
    expect(Object.keys(env).filter((name) => name.toUpperCase() === 'USERPROFILE')).toEqual(['USERPROFILE']);
    for (const name of ['APPDATA', 'LOCALAPPDATA', 'TEMP', 'TMP']) expect(isInside(env[name]!, home)).toBe(true);
    expect(Object.values(env).some((value) => value.includes('C:\\Users\\me'))).toBe(false);
    for (const path of [env.APPDATA!, env.TEMP!]) expect(homeDirs(home)).toContain(path);
  });
});

describe('powershellCommandLine', () => {
  const decode = (line: string) => Buffer.from(line.split(' ').at(-1)!, 'base64').toString('utf16le');

  it('コマンドを符号化して渡す（引用符や改行をそのまま保つ）', () => {
    const command = 'Write-Output "a b" \'c\'\n$x = 1; echo `"$x`"';
    const line = powershellCommandLine(command, { SystemRoot: windows });
    expect(line).toContain(join(windows, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe'));
    expect(line).toContain('-NoProfile -NonInteractive');
    // 隔離の中では実行ポリシーの確認が失敗するので、確かめさせない（npm などの .ps1 の入口のため）
    expect(line).toContain('-ExecutionPolicy Bypass');
    expect(line).not.toContain('Write-Output');
    expect(decode(line)).toContain(command);
    expect(decode(line)).toContain('exit $LASTEXITCODE');
  });

  it('長すぎるコマンドは断る', () => {
    expect(() => powershellCommandLine('x'.repeat(COMMAND_MAX_CHARS), {})).not.toThrow();
    expect(() => powershellCommandLine('x'.repeat(COMMAND_MAX_CHARS + 1), {})).toThrow('文字まで');
  });
});

describe('containerConfig', () => {
  const config = containerConfig(scope, 'cmd', { SystemRoot: windows, PATH: '', MY_SECRET: 'x', LANG: 'ja' }, 30_000);
  const filesystem = config.filesystem as { readwritePaths: string[]; readonlyPaths: string[]; deniedPaths: string[] };
  const process = config.process as { env: string[]; inheritDefaultEnv: boolean; cwd: string; timeout: number };

  it('書けるのは作業場所と専用のホームだけ、読めるのは相談元と道具だけ、通信はすべて拒否', () => {
    expect(filesystem.readwritePaths).toEqual([work, home]);
    expect(filesystem.readonlyPaths).toEqual([peer]);
    expect(config.network).toEqual({ egress: { default: 'deny' } });
    expect(config.ui).toEqual({ disable: false, clipboard: 'none', injection: false });
    expect(config.containment).toBe('processcontainer');
    expect(process).toMatchObject({ cwd: work, timeout: 30_000 });
  });

  it('利用者の環境変数を既定では引き継がせず、秘密らしいものを除いて明示して渡す', () => {
    expect(process.inheritDefaultEnv).toBe(false);
    expect(process.env).toContain('LANG=ja');
    expect(process.env).toContain(`USERPROFILE=${home}`);
    expect(process.env.some((entry) => entry.startsWith('MY_SECRET='))).toBe(false);
  });

  it('書ける場所の中にある読み取り専用の指定は足さない（狭い方の許可で打ち消さない）', () => {
    const inside = containerConfig({ ...scope, readable: [join(work, 'skills'), peer] }, 'cmd', {}, 1000);
    expect((inside.filesystem as { readonlyPaths: string[] }).readonlyPaths).toEqual([peer]);
  });

  it('「一覧だけ」の親フォルダに、許可した場所そのものを含めない', () => {
    const container = config.processContainer as { filesystem: { enumeratePaths: string[] } };
    const granted = [...filesystem.readwritePaths, ...filesystem.readonlyPaths];
    expect(container.filesystem.enumeratePaths).toContain(dirname(work));
    expect(container.filesystem.enumeratePaths.some((path) => granted.includes(path))).toBe(false);
  });
});
