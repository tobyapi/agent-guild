import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { PermissionRule, Permissions } from '../protocol.ts';
import {
  BackendError,
  brokenRule,
  classifyErrorText,
  declaredRules,
  isInside,
  optionChoice,
  optionPositiveInt,
  rejectUnenforceable,
} from './types.ts';

describe('classifyErrorText', () => {
  it('SDK の失敗の文面を ErrorCode に分類する', () => {
    expect(classifyErrorText('unexpected status 401 Unauthorized')).toBe('auth');
    expect(classifyErrorText('Not logged in · Please run /login')).toBe('auth');
    expect(classifyErrorText('429 Too Many Requests')).toBe('rate_limit');
    expect(classifyErrorText("The model 'gpt-9' does not exist")).toBe('model_not_found');
    expect(classifyErrorText('stream disconnected')).toBe('internal');
  });
});

describe('options の読み取り', () => {
  it('型と候補が合うときだけ使う', () => {
    expect(optionChoice({ effort: 'high' }, 'effort', ['low', 'high'])).toBe('high');
    expect(optionChoice({ effort: 'HIGH' }, 'effort', ['low', 'high'])).toBeUndefined();
    expect(optionPositiveInt({ n: 3 }, 'n')).toBe(3);
    expect(optionPositiveInt({ n: 1.5 }, 'n')).toBeUndefined();
    expect(optionPositiveInt({ n: '3' }, 'n')).toBeUndefined();
  });
});

describe('brokenRule', () => {
  const ALL: Permissions = {
    webSearch: true,
    webFetch: true,
    readFiles: true,
    readAnywhere: false,
    writeFiles: true,
    writeAnywhere: true,
    runCommands: true,
    skills: true,
  };
  const rules: PermissionRule[] = [{ when: 'writeFiles', requires: ['runCommands'] }];

  it('when が許されていて requires が欠けている規則を返す', () => {
    expect(brokenRule(rules, { ...ALL, runCommands: false })).toEqual({
      when: 'writeFiles',
      requires: ['runCommands'],
    });
  });

  it('when が許されていなければ、または requires がそろっていれば破っていない', () => {
    expect(brokenRule(rules, { ...ALL, writeFiles: false, runCommands: false })).toBeUndefined();
    expect(brokenRule(rules, ALL)).toBeUndefined();
  });

  it('理由つきの規則はそのまま返し、申告するときは理由を外す', () => {
    const explained = [{ when: 'writeFiles' as const, requires: ['runCommands' as const], reason: '止められません' }];
    expect(brokenRule(explained, { ...ALL, runCommands: false })?.reason).toBe('止められません');
    expect(declaredRules(explained)).toEqual(rules);
  });
});

describe('rejectUnenforceable', () => {
  it('理由があれば unsupported_permission で拒否する', () => {
    expect(() => rejectUnenforceable('Codex', null)).not.toThrow();
    expect(() => rejectUnenforceable('Codex', '止められません')).toThrow(BackendError);
    expect(() => rejectUnenforceable('Codex', '止められません')).toThrow('Codex: 止められません');
  });
});

describe('isInside', () => {
  const work = resolve('/guild-data/agents/a1/work');

  it('root の中（root 自身を含む）だけ true', () => {
    expect(isInside(join(work, 'notes', 'a.md'), work)).toBe(true);
    expect(isInside(work, work)).toBe(true);
    expect(isInside(join(work, '..evil-but-inside'), work)).toBe(true);
    expect(isInside(join(work, '..', 'state', 'x'), work)).toBe(false);
    expect(isInside(resolve('/guild-data/agents/a0/work'), work)).toBe(false);
    expect(isInside(`${work}-evil`, work)).toBe(false);
  });
});
