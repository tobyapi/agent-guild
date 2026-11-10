// 契約の実例（contracts/runner/*.jsonl）を読み、ランナーが解釈・生成するものと一致することを確かめる。
// 同じファイルを runner-client（Rust）のテストも読む。

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createBuiltinRegistry } from './backends/registry.ts';
import { EMPTY_CATALOG } from './backends/types.ts';
import { parseLine, serializeEvent, type JsonObject } from './line-parser.ts';
import type { RunnerEvent } from './protocol.ts';
import { decodeRequest } from './request-decoder.ts';

function fixture(name: string): JsonObject[] {
  const text = readFileSync(new URL(`../../contracts/runner/${name}`, import.meta.url), 'utf8');
  return text.split('\n').flatMap((line) => {
    const parsed = parseLine(line);
    if (parsed.kind === 'malformed') throw new Error(`${name} に読めない行があります: ${line}`);
    return parsed.kind === 'message' ? [parsed.value] : [];
  });
}

const EVENT_TYPES = ['ready', 'backends', 'activity', 'post', 'result', 'error'];
const sortedKeys = (value: object): string[] => Object.keys(value).sort();

describe('contracts/runner', () => {
  it('requests.jsonl の要求はすべて検証を通り、書き戻すと元と一致する', () => {
    const requests = fixture('requests.jsonl');
    expect(requests.map((request) => request.type)).toEqual(['run', 'login', 'cancel', 'probe', 'shutdown', 'apiKey']);
    for (const expected of requests) {
      const decoded = decodeRequest(expected);
      expect(decoded.ok).toBe(true);
      if (decoded.ok) expect(JSON.parse(JSON.stringify(decoded.request))).toEqual(expected);
    }
  });

  it('events.jsonl のイベントは既知の type で、直列化すると元と一致する', () => {
    for (const expected of fixture('events.jsonl')) {
      expect(EVENT_TYPES).toContain(expected.type);
      expect(JSON.parse(serializeEvent(expected as unknown as RunnerEvent))).toEqual(expected);
    }
  });

  it('アダプタが申告する BackendInfo は実例と同じフィールドを持つ', () => {
    const ready = fixture('events.jsonl').find((event) => event.type === 'ready') as unknown as
      Extract<RunnerEvent, { type: 'ready' }> | undefined;
    const example = ready?.backends[0];
    expect(example).toBeDefined();
    if (!example) return;
    expect(sortedKeys(example.models[0] ?? {})).toEqual(['defaultEffort', 'description', 'efforts', 'id', 'label']);
    const registry = createBuiltinRegistry();
    for (const id of ['claude', 'codex', 'grok', 'muse', 'ollama']) {
      // 状態やモデルは実行環境で変わるので、ここでは形だけを合わせる
      const descriptor = registry.find(id)?.info();
      expect(descriptor).toBeDefined();
      if (!descriptor) continue;
      const info = { ...descriptor, status: 'ready', statusMessage: '', ...EMPTY_CATALOG };
      expect(sortedKeys(info)).toEqual(sortedKeys(example));
      expect(sortedKeys(info.capabilities)).toEqual(sortedKeys(example.capabilities));
      for (const option of info.options) expect(sortedKeys(option)).toEqual(sortedKeys(example.options[0] ?? {}));
    }
  });
});
