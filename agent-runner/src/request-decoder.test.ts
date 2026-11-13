import { describe, expect, it } from 'vitest';
import { decodeRequest } from './request-decoder.ts';

const PERMISSIONS = {
  webSearch: true,
  webFetch: true,
  readFiles: true,
  readAnywhere: false,
  writeFiles: false,
  writeAnywhere: false,
  runCommands: false,
  skills: true,
};
const RUN = {
  type: 'run',
  id: 'job-1',
  backend: 'claude',
  workspace: '/data/agents/a1/work',
  stateDir: '/data/agents/a1/state/claude',
  readableDirs: ['/data/agents/a0/work'],
  systemPrompt: 'あなたはロジカです',
  prompt: 'レビューしてください',
  intent: '# 人間の依頼\n> レビューして',
  model: '',
  permissions: PERMISSIONS,
  skills: [
    {
      name: 'review-checklist',
      description: '手順',
      body: '# 手順',
      dir: null,
      files: [{ path: 'references/examples.md', content: '# 例' }],
    },
    {
      name: 'unity-performance',
      description: 'Unity の指摘',
      body: '# 手順',
      dir: '/skills/unity-performance',
      files: [],
    },
  ],
  images: [{ path: '/data/attachments/c1/i1.png', mediaType: 'image/png' }],
  options: { maxTurns: 3 },
};

describe('decodeRequest', () => {
  it('decodes only supported backend authentication mode changes', () => {
    expect(decodeRequest({ type: 'backendAuthMode', id: 'mode-1', backend: 'claude', mode: 'api' })).toEqual({
      ok: true,
      request: { type: 'backendAuthMode', id: 'mode-1', backend: 'claude', mode: 'api' },
    });
    expect(decodeRequest({ type: 'backendAuthMode', id: 'mode-2', backend: 'grok', mode: 'api' })).toMatchObject({
      ok: false,
      id: 'mode-2',
    });
  });

  it('run を検証し、未知のフィールドは捨てる', () => {
    const decoded = decodeRequest({
      ...RUN,
      future: 1,
      permissions: { ...PERMISSIONS, bash: true },
      skills: [{ ...RUN.skills[0], icon: '📝' }, RUN.skills[1]],
      images: [{ ...RUN.images[0], width: 10 }],
    });
    expect(decoded).toEqual({ ok: true, request: RUN });
  });

  it('文字列のフィールドが不正なら、どれかを返す', () => {
    const decoded = decodeRequest({ ...RUN, stateDir: 1, model: undefined });
    expect(decoded).toMatchObject({ ok: false, id: 'job-1' });
    if (!decoded.ok) expect(decoded.message).toContain('stateDir・model');
  });

  it.each([
    ['permissions に runCommands がない', { permissions: { ...PERMISSIONS, runCommands: undefined } }],
    ['skills の要素が欠けている', { skills: [{ name: 'x' }] }],
    ['skills が配列でない', { skills: {} }],
    ['skills の dir がない', { skills: [{ name: 'x', description: 'd', body: 'b' }] }],
    ['skills の dir が文字列でも null でもない', { skills: [{ name: 'x', description: 'd', body: 'b', dir: 1 }] }],
    ['skills の files がない', { skills: [{ name: 'x', description: 'd', body: 'b', dir: null }] }],
    [
      'skills の files の content がない',
      { skills: [{ name: 'x', description: 'd', body: 'b', dir: null, files: [{ path: 'a.md' }] }] },
    ],
    ['readableDirs に文字列以外', { readableDirs: ['/a', 1] }],
    ['images がない', { images: undefined }],
    ['images の mediaType がない', { images: [{ path: '/a.png' }] }],
    ['options が配列', { options: [] }],
  ])('%s → 不正（id を返す）', (_label, patch) => {
    expect(decodeRequest({ ...RUN, ...patch })).toMatchObject({ ok: false, id: 'job-1' });
  });

  it('id のない run・cancel は id: null で不正', () => {
    expect(decodeRequest({ ...RUN, id: '' })).toMatchObject({ ok: false, id: null });
    expect(decodeRequest({ type: 'cancel' })).toMatchObject({ ok: false, id: null });
  });

  it('login は id と backend を持つ（どちらかが欠ければ不正）', () => {
    expect(decodeRequest({ type: 'login', id: 'login-1', backend: 'claude', extra: true })).toEqual({
      ok: true,
      request: { type: 'login', id: 'login-1', backend: 'claude' },
    });
    expect(decodeRequest({ type: 'login', backend: 'claude' })).toMatchObject({ ok: false, id: null });
    expect(decodeRequest({ type: 'login', id: 'login-1' })).toMatchObject({ ok: false, id: 'login-1' });
  });

  it('image は文字列の6項目・skills と id を持つ（output が空・欠けた項目・不正な skills は不正。未知のフィールドは捨てる）', () => {
    const image = {
      type: 'image',
      id: 'frame-1',
      backend: 'codex',
      workspace: '/w',
      stateDir: '/s',
      systemPrompt: 'sys',
      prompt: 'p',
      skills: [{ name: 'ornate-avatar-frame', description: 'd', body: '# b', dir: null, files: [] }],
      output: '/s/frame.png',
    };
    expect(decodeRequest({ ...image, permissions: {} })).toEqual({ ok: true, request: image });
    expect(decodeRequest({ ...image, output: '' })).toMatchObject({ ok: false, id: 'frame-1' });
    expect(decodeRequest({ ...image, prompt: 1 })).toMatchObject({ ok: false, id: 'frame-1' });
    expect(decodeRequest({ ...image, id: '' })).toMatchObject({ ok: false, id: null });
    expect(decodeRequest({ ...image, skills: undefined })).toMatchObject({ ok: false, id: 'frame-1' });
    expect(decodeRequest({ ...image, skills: [{ name: 'x', description: 'd', body: 'b', dir: null }] })).toMatchObject({
      ok: false,
      id: 'frame-1',
    });
  });

  it('cancel・probe・shutdown', () => {
    expect(decodeRequest({ type: 'cancel', id: 'job-1', reason: 'x' })).toEqual({
      ok: true,
      request: { type: 'cancel', id: 'job-1' },
    });
    expect(decodeRequest({ type: 'probe', id: 'p1' })).toEqual({ ok: true, request: { type: 'probe', id: 'p1' } });
    expect(decodeRequest({ type: 'probe' }).ok).toBe(false);
    expect(decodeRequest({ type: 'shutdown' })).toEqual({ ok: true, request: { type: 'shutdown' } });
  });

  it('未知の type・type なしは不正（id があれば返す）', () => {
    expect(decodeRequest({ type: 'pause', id: 'job-9' })).toEqual({
      ok: false,
      id: 'job-9',
      message: '未知の type です: pause',
    });
    expect(decodeRequest({ type: 'pause' })).toMatchObject({ ok: false, id: null });
  });
});
