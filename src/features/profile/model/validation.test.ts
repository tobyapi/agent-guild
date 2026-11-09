import { describe, expect, it } from 'vitest';
import { validateProfile } from './validation';

describe('validateProfile', () => {
  it('問題がなければ空', () => {
    expect(validateProfile({ name: 'あなた', avatar: '🙂', color: '#ea856b' }, ['ハル'])).toEqual({});
  });

  it('エージェントと同じ名前・長すぎるアバター・色の未選択を指摘する', () => {
    expect(validateProfile({ name: 'はる', avatar: 'とても長いアバターの文字列です本当に', color: '' }, ['はる'])).toEqual({
      name: 'その名前はすでに使われています',
      avatar: 'アバターは絵文字 1 つか画像にしてください',
      color: '色を選んでください',
    });
  });
});
