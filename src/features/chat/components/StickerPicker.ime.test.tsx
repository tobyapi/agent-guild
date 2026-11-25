// @vitest-environment jsdom
// IME（日本語入力の変換）とスタンプの差し込みの関係
import { fireEvent, render } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { composerDrafts } from '../draftStore';
import { first, Input, items, second, setupStickerTests, textbox, trigger } from './StickerPicker.test-support';

vi.mock('../store', () => ({ sendMessage: vi.fn() }));
setupStickerTests();

it('waits for IME composition to finish before inserting, so the composed text is not broken', () => {
  render(<Input id="a" />);
  const input = textbox();
  fireEvent.change(input, { target: { value: 'こんにちは' } });
  fireEvent.compositionStart(input);
  fireEvent.change(input, { target: { value: 'こんにちはせかい' } });
  fireEvent.click(trigger());
  fireEvent.click(items()[0]!);
  // 変換中は差し込まない
  expect(input.value).toBe('こんにちはせかい');

  // 確定（確定の input より先に compositionend が来ても、確定後の値に対して差し込む）
  input.value = 'こんにちは世界';
  input.setSelectionRange(7, 7);
  fireEvent.compositionEnd(input);
  expect(input.value).toBe(`こんにちは世界${first()}`);
  expect(composerDrafts.text('a')).toBe(`こんにちは世界${first()}`);
  expect(input.selectionStart).toBe(7 + first().length);
});

it('does not stay stuck when compositionend never arrives: a non-IME key or blur ends the composition', () => {
  render(<Input id="a" />);
  const input = textbox();
  // compositionend が届かない変換（IME の切り替えなど）
  fireEvent.compositionStart(input);
  fireEvent.change(input, { target: { value: '世界' } });
  fireEvent.click(trigger());
  fireEvent.click(items()[0]!);
  expect(input.value).toBe('世界');
  // 変換中のキー（keyCode 229）では、まだ待つ
  fireEvent.keyDown(input, { key: 'Process', keyCode: 229 });
  expect(input.value).toBe('世界');
  // 変換中でないキーが来たら、待っていた定型文を差し込む
  input.setSelectionRange(2, 2);
  fireEvent.keyDown(input, { key: 'ArrowRight', keyCode: 39 });
  expect(input.value).toBe(`世界${first()}`);

  // 次からは変換中扱いのまま止まらず、すぐ差し込む
  fireEvent.click(trigger());
  fireEvent.click(items()[1]!);
  expect(input.value).toBe(`世界${first()}${second()}`);

  // フォーカスが外れた場合も印を下ろす（一覧を開くとフォーカスが項目へ移る）
  input.focus();
  fireEvent.compositionStart(input);
  fireEvent.click(trigger());
  expect(document.activeElement).toBe(items()[0]);
  fireEvent.click(items()[0]!);
  expect(input.value).toBe(`世界${first()}${second()}${first()}`);
});
