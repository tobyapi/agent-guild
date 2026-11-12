import { afterEach, describe, expect, it, vi } from 'vitest';
import { activity } from './backends/describe.ts';
import { BackendRegistry } from './backends/registry.ts';
import { ollamaAdapter } from './backends/ollama.ts';
import type { BackendAdapter } from './backends/types.ts';
import { PLAIN } from './backends/descriptor.test-support.ts';
import { Dispatcher } from './dispatcher.ts';
import { createTranslator, currentLanguage, format, parseLanguage, setLanguage } from './i18n.ts';
import { parseLine } from './line-parser.ts';
import type { RunnerEvent } from './protocol.ts';
import { decodeRequest } from './request-decoder.ts';

afterEach(() => setLanguage('ja'));

describe('言語', () => {
  it('知っている5つの言語だけを読む（環境変数がなければ日本語）', () => {
    expect(currentLanguage()).toBe('ja');
    expect(parseLanguage('zh-Hant')).toBe('zh-Hant');
    expect(parseLanguage('zh')).toBeNull();
    expect(parseLanguage(undefined)).toBeNull();
  });

  it('いまの言語の表から引き、{name} を置き換える（値の中の {…} は残す）', () => {
    const t = createTranslator({
      ja: { hello: '{name}さん' },
      en: { hello: 'Hi {name}' },
      'zh-Hans': { hello: '{name}' },
      'zh-Hant': { hello: '{name}' },
      ko: { hello: '{name}님' },
    });
    expect(t('hello', { name: '{x}' })).toBe('{x}さん');
    setLanguage('en');
    expect(t('hello', { name: 'Taro' })).toBe('Hi Taro');
    expect(format('{a} {b}', { a: 1 })).toBe('1 {b}');
  });

  it('途中経過と BackendInfo の説明は、呼んだ時点の言語で作る', () => {
    expect(activity.command('npm test')).toBe('コマンド実行: npm test');
    setLanguage('en');
    expect(activity.command('npm test')).toBe('Running command: npm test');
    expect(ollamaAdapter.info().options.map((option) => option.label)).toContain('Enable tools');
  });
});

describe('setLanguage 要求', () => {
  it('言語を検証する（不正なら理由つきで拒否）', () => {
    expect(decodeRequest({ type: 'setLanguage', language: 'ko' })).toEqual({
      ok: true,
      request: { type: 'setLanguage', language: 'ko' },
    });
    expect(decodeRequest({ type: 'setLanguage', language: 'fr' })).toMatchObject({ ok: false, id: null });
    expect(decodeRequest({ type: 'setLanguage', id: 'x' })).toMatchObject({ ok: false, id: 'x' });
  });

  it('言語を変えて、新しい言語の説明で backends を送り直す（返事はない）', async () => {
    const adapter: BackendAdapter = {
      info: () => ({
        ...PLAIN,
        id: 'fake',
        label: activity.thinking(),
        capabilities: ollamaAdapter.info().capabilities,
        options: [],
        permissionRules: [],
        leakRisks: [],
        unrestricted: [],
        midRunPost: null,
      }),
      probe: () => Promise.resolve({ status: 'ready', statusMessage: activity.writing() }),
      run: () => Promise.resolve(''),
    };
    const events: RunnerEvent[] = [];
    const dispatcher = new Dispatcher({
      registry: new BackendRegistry([adapter]),
      runnerVersion: 'test',
      send: (event) => events.push(event),
      exit: vi.fn(),
    });
    dispatcher.receive(parseLine(JSON.stringify({ type: 'setLanguage', language: 'en' })));
    await vi.waitFor(() => expect(events).toHaveLength(1));
    expect(currentLanguage()).toBe('en');
    expect(events[0]).toMatchObject({
      type: 'backends',
      backends: [{ label: 'Thinking…', statusMessage: 'Writing…' }],
    });
  });
});
