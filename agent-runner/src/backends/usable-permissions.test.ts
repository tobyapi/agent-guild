// 権限は役割で決まり、どのバックエンドにも同じものが届く。ランナーはその中で、バックエンドが守って使える操作だけを
// アダプタに渡す。許可を足さないこと・絞ったあとは各アダプタが守れる組み合わせになっていることを、全部の組み合わせで確かめる。
import { describe, expect, it } from 'vitest';
import cases from '../../../contracts/behavior/role-permissions.json' with { type: 'json' };
import type { PermissionKey, Permissions } from '../protocol.ts';
import { unenforceableReason as claudeReason } from './claude/permissions.ts';
import { unenforceableReason as codexReason } from './codex-runtime/options.ts';
import { validatePermissions as validateOllama } from './ollama/policy.ts';
import { createBuiltinRegistry } from './registry.ts';
import { pretendMacOS, runRequest } from './run.test-support.ts';
import { brokenRule, usablePermissions, usableRequest } from './types.ts';

// Ollama の道具は macOS だけで有効になる（共有の実例も macOS での値）
pretendMacOS();

const KEYS: PermissionKey[] = [
  'webSearch',
  'webFetch',
  'readFiles',
  'readAnywhere',
  'writeFiles',
  'writeAnywhere',
  'runCommands',
  'skills',
];
const EVERY_GRANT: Permissions[] = Array.from(
  { length: 2 ** KEYS.length },
  (_, mask) => Object.fromEntries(KEYS.map((key, bit) => [key, Boolean(mask & (1 << bit))])) as Permissions,
);
const BACKENDS = ['claude', 'codex', 'grok', 'muse', 'ollama'];
const info = (id: string) => createBuiltinRegistry().find(id)!.info();

describe('役割の権限と、バックエンドで使える操作（Rust・画面と共有の実例）', () => {
  it.each(cases)('$name', (example) => {
    expect(usablePermissions(example.permissions, info(example.backend))).toEqual(example.usable);
  });

  it('同じ役割の権限は、どのバックエンドの実例でも同じ', () => {
    for (const example of cases) {
      const same = cases.filter((other) => JSON.stringify(other.tags) === JSON.stringify(example.tags));
      for (const other of same) expect(other.permissions).toEqual(example.permissions);
    }
  });
});

describe.each(BACKENDS)('%s: 256 通りの権限のどれを渡されても', (id) => {
  it('許可を足さず、申告した規則を満たす組み合わせに絞る（2回絞っても同じ）', () => {
    const backend = info(id);
    for (const granted of EVERY_GRANT) {
      const usable = usablePermissions(granted, backend);
      for (const key of KEYS) {
        expect(usable[key] && !granted[key], `${key} を足さない`).toBe(false);
        expect(usable[key] && !backend.capabilities[key], `道具がない ${key} は使わない`).toBe(false);
      }
      expect(brokenRule(backend.permissionRules, usable)).toBeUndefined();
      expect(usablePermissions(usable, backend)).toEqual(usable);
    }
  });

  it('依頼のほかの項目は変えず、元の依頼も書き換えない', () => {
    const request = { ...runRequest(id), permissions: EVERY_GRANT[EVERY_GRANT.length - 1]! };
    const before = structuredClone(request);
    const narrowed = usableRequest(request, info(id));
    expect(request).toEqual(before);
    expect({ ...narrowed, permissions: request.permissions }).toEqual(request);
  });
});

// このテストでは Windows の隔離（MXC）を確かめていないので、コマンドは使えない扱いになる（使える PC での申告は ollama/windows-command.test.ts）
describe('Ollama は、隔離できない PC ではコマンドと PC 全体への書き込みを使わない', () => {
  const worker = cases.find((example) => example.name === '作業者 / ollama')!;
  const usableOn = (platform: NodeJS.Platform) => {
    const original = process.platform;
    Object.defineProperty(process, 'platform', { value: platform });
    try {
      return usablePermissions(worker.permissions, info('ollama'));
    } finally {
      Object.defineProperty(process, 'platform', { value: original });
    }
  };

  it.each(['win32', 'linux'] as const)('%s: ファイルの読み書きとスキルだけを使う（権限は同じ）', (platform) => {
    expect(usableOn(platform)).toEqual({
      ...worker.usable,
      writeAnywhere: false,
      runCommands: false,
    });
    expect(usableOn(platform)).toMatchObject({ readFiles: true, writeFiles: true, skills: true });
  });

  it('macOS では Seatbelt の中で、コマンドと PC 全体への書き込みも使う', () => {
    expect(usableOn('darwin')).toEqual(worker.usable);
    expect(worker.usable).toMatchObject({ writeAnywhere: true, runCommands: true });
  });
});

describe('絞ったあとの権限は、各アダプタが守れる', () => {
  it('Claude: コマンドは、外への書き込みと Web も許す役割でだけ残る', () => {
    for (const granted of EVERY_GRANT) {
      const usable = usablePermissions(granted, info('claude'));
      expect(claudeReason(usable)).toBeNull();
      if (usable.runCommands) expect(usable.writeAnywhere && usable.webFetch && usable.webSearch).toBe(true);
    }
  });

  it.each(['codex', 'grok', 'muse'])('%s: 止められない読み取りとスキルを除けば、拒否は残らない', (id) => {
    for (const granted of EVERY_GRANT) {
      const usable = usablePermissions(granted, info(id));
      // 読み取りとスキルは Codex が止められない（許可がなければ、絞らずに実行そのものを拒否する）
      if (usable.readFiles && usable.skills) expect(codexReason(usable)).toBeNull();
      else expect(codexReason(usable)).not.toBeNull();
    }
  });

  it('Ollama: Web と作業フォルダの外の読み取りは残らない', () => {
    for (const granted of EVERY_GRANT) {
      const request = usableRequest({ ...runRequest('ollama'), permissions: granted }, info('ollama'));
      expect(() => validateOllama(request)).not.toThrow();
    }
  });
});
