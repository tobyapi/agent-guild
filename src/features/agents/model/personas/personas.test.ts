import { describe, expect, it } from 'vitest';
import { PERSONALITIES } from './personalities';
import {
  appendPresetText,
  findPreset,
  groupHeadingAt,
  matchingPreset,
  PRESET_GROUP_LABELS,
  searchPresets,
} from './presetText';
import { TONES } from './tones';
import type { AnyPreset, PresetGroup, TonePreset } from './types';

const docs = import.meta.glob<string>('/docs/persona-presets.md', { eager: true, query: '?raw', import: 'default' });
const markdown = docs['/docs/persona-presets.md'] ?? '';

/** 見出しの下の最初の表の行（見出し行と区切り行を除く）を、セルの配列で返す */
function tableRows(heading: string): string[][] {
  const lines = markdown.slice(markdown.indexOf(heading)).split(/\r?\n/).slice(1);
  const start = lines.findIndex((line) => line.startsWith('|'));
  const end = lines.findIndex((line, index) => index > start && !line.startsWith('|'));
  return lines
    .slice(start, end < 0 ? undefined : end)
    .slice(2)
    .map((line) =>
      line
        .trim()
        .replace(/^\||\|$/g, '')
        .split('|')
        .map((cell) => cell.trim()),
    );
}

/** 組で絞る（undefined は定番） */
function inGroup<T extends AnyPreset>(presets: readonly T[], group: PresetGroup | undefined): T[] {
  return presets.filter((preset) => preset.group === group);
}

describe('文面の正（docs/persona-presets.md）との一致', () => {
  it('性格の id・label・text が表と同じ順・同じ文面（定番とキャラクター）', () => {
    expect(markdown).not.toBe('');
    const row = ({ id, label, text }: AnyPreset) => [id, label, text];
    expect(inGroup(PERSONALITIES, undefined).map(row)).toEqual(tableRows('## 性格（personality）'));
    expect(inGroup(PERSONALITIES, 'character').map(row)).toEqual(tableRows('### キャラクターの性格'));
  });

  it('話し方の id・label・text・sample が表と同じ順・同じ文面（定番とキャラクター）', () => {
    const row = ({ id, label, text, sample }: TonePreset) => [id, label, text, sample];
    expect(inGroup(TONES, undefined).map(row)).toEqual(tableRows('## 話し方（tone）'));
    expect(inGroup(TONES, 'character').map(row)).toEqual(tableRows('### キャラクターの話し方'));
  });
});

describe('プリセットの表', () => {
  it.each([
    ['性格', PERSONALITIES],
    ['話し方', TONES],
  ] as const)('%s: id は英小文字とハイフンで重複せず、文面は空でない', (_name, presets) => {
    const ids = presets.map((preset) => preset.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const preset of presets) {
      expect(preset.id).toMatch(/^[a-z]+(?:-[a-z]+)*$/);
      expect(preset.label.trim()).not.toBe('');
      expect(preset.text.trim()).not.toBe('');
    }
    expect(TONES.every((tone) => tone.sample.trim() !== '')).toBe(true);
  });

  it.each([
    ['性格', PERSONALITIES],
    ['話し方', TONES],
  ] as const)('%s: 同じ組は続けて並ぶ（見出しは組ごとに一度だけ）', (_name, presets) => {
    const headings = presets
      .map((_preset, index) => groupHeadingAt(presets, index))
      .filter((heading) => heading !== null);
    expect(headings).toEqual([PRESET_GROUP_LABELS.character]);
  });

  it('キャラクターは性格と話し方で同じ id・label の対になっている', () => {
    const pair = ({ id, label }: AnyPreset) => [id, label];
    expect(inGroup(PERSONALITIES, 'character').map(pair)).toEqual(inGroup(TONES, 'character').map(pair));
    expect(inGroup(PERSONALITIES, 'character').length).toBeGreaterThan(0);
  });
});

describe('searchPresets', () => {
  it('label・text・sample から、NFKC＋大文字小文字を無視して空白区切りの全語で探す', () => {
    expect(searchPresets(PERSONALITIES, '論理').map((preset) => preset.id)).toEqual(['logical']);
    expect(searchPresets(TONES, 'ござる').map((preset) => preset.id)).toEqual(['samurai']);
    expect(searchPresets(TONES, 'Ａ 案').map((preset) => preset.id)).toEqual(['business']);
    expect(searchPresets(PERSONALITIES, '前向き 提案').map((preset) => preset.id)).toEqual(['curious']);
    expect(searchPresets(PERSONALITIES, '  ')).toHaveLength(PERSONALITIES.length);
    expect(searchPresets(TONES, 'みつからない')).toEqual([]);
  });

  it('キャラクターも label と口調の特徴で探せる', () => {
    expect(searchPresets(PERSONALITIES, 'ツンデレ').map((preset) => preset.id)).toEqual(['tsundere']);
    expect(searchPresets(TONES, 'ですわ').map((preset) => preset.id)).toEqual(['ojousama']);
    expect(searchPresets(TONES, 'っす').map((preset) => preset.id)).toEqual(['kouhai']);
  });
});

describe('groupHeadingAt', () => {
  const items: AnyPreset[] = [
    { id: 'a', label: 'A', text: 'a' },
    { id: 'b', label: 'B', text: 'b', group: 'character' },
    { id: 'c', label: 'C', text: 'c', group: 'character' },
  ];

  it('組が変わる行だけ見出しを返す（定番には見出しを出さない）', () => {
    expect(items.map((_item, index) => groupHeadingAt(items, index))).toEqual([
      null,
      PRESET_GROUP_LABELS.character,
      null,
    ]);
  });

  it('検索で定番が消えてキャラクターから始まるときは、先頭に見出しを出す', () => {
    expect(groupHeadingAt(items.slice(1), 0)).toBe(PRESET_GROUP_LABELS.character);
    expect(groupHeadingAt(items, 3)).toBeNull();
  });
});

describe('matchingPreset / appendPresetText / findPreset', () => {
  it('入力欄の文面とちょうど同じプリセットを見つける（前後の空白は無視）', () => {
    const curious = findPreset(PERSONALITIES, 'curious');
    expect(matchingPreset(PERSONALITIES, ` ${curious?.text ?? ''}\n`)?.label).toBe('好奇心旺盛');
    expect(matchingPreset(PERSONALITIES, `${curious?.text ?? ''}追加`)).toBeUndefined();
    expect(matchingPreset(PERSONALITIES, '')).toBeUndefined();
  });

  it('追記は句点でつなぐ（空なら置き換えと同じ、句点で終わっていれば重ねない）', () => {
    expect(appendPresetText('', '慎重に動く。')).toBe('慎重に動く。');
    expect(appendPresetText('明るい。', '慎重に動く。')).toBe('明るい。慎重に動く。');
    expect(appendPresetText('明るい ', '慎重に動く。')).toBe('明るい。慎重に動く。');
  });
});
