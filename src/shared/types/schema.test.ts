import { describe, expect, it } from 'vitest';
import { arrayOf, nullable, number, objectOf, omitKeys, oneOf, string } from './schema';
import type { Schema } from './schema';

interface Pet {
  name: string;
  age: number | null;
  kind: 'cat' | 'dog';
}

const petSchema = {
  name: string,
  age: nullable(number),
  kind: oneOf<Pet['kind']>({ cat: true, dog: true }),
} satisfies Schema<Pet>;

const pet = objectOf(petSchema);

describe('objectOf', () => {
  it('契約どおりの値は問題なし', () => {
    expect(pet({ name: 'タマ', age: null, kind: 'cat' }, 'pet')).toEqual([]);
  });

  it('型の違い・キーの抜け・契約にないキーをパスつきで報告する', () => {
    expect(pet({ name: 1, kind: 'bird', extra: true }, 'pet')).toEqual([
      'pet.name: 文字列ではありません',
      'pet.age: 数値ではありません',
      'pet.kind: cat / dog のどれかではありません',
      'pet.extra: 契約にないキーです',
    ]);
  });

  it('オブジェクトでなければそう報告する', () => {
    expect(pet([], 'pet')).toEqual(['pet: オブジェクトではありません']);
  });
});

describe('arrayOf / omitKeys', () => {
  it('配列の要素ごとに添字つきで報告する', () => {
    expect(arrayOf(string)(['a', 2], 'list')).toEqual(['list[1]: 文字列ではありません']);
  });

  it('omitKeys で除いたキーは検証しない', () => {
    const named = objectOf(omitKeys(petSchema, ['age', 'kind']));
    expect(named({ name: 'ポチ' }, 'pet')).toEqual([]);
  });
});
