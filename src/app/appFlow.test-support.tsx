// 画面の振る舞いのテスト用の部品: アプリ全体を、ブラウザで動かすときと同じモックのバックエンドで起動し、
// 偽のタイマーで時間を進める。モックとストアはテストファイルごとに1つなので、1ファイルの中のテストは
// 同じ起動の続きとして順に動かす（bootApp は beforeAll で1回だけ呼ぶ）。
// 使うテストは先頭に「// @vitest-environment jsdom」を書く（ほかのテストは node のまま）。
import { act, cleanup, render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { App } from './App';

/** 偽のタイマーを ms だけ進め、そのあいだの画面の更新を反映する */
export const advance = (ms: number) =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });

/** jsdom の <dialog> には showModal と close がないので、open 属性の付け外しで代える */
function polyfillDialog(): void {
  const dialog = window.HTMLDialogElement.prototype;
  if ('showModal' in dialog) return;
  Object.assign(dialog, {
    showModal(this: HTMLDialogElement) {
      this.setAttribute('open', '');
    },
    close(this: HTMLDialogElement) {
      this.removeAttribute('open');
      this.dispatchEvent(new Event('close'));
    },
  });
}

/** アプリを起動し、最初のチャンネルの発言が読み込まれるまで進める */
export async function bootApp(): Promise<void> {
  // モックのバックエンドは最初に使うときに読み込まれる。偽のタイマーのもとでは読み込みが進まないので、先に済ませておく
  await import('@/shared/api/mock');
  polyfillDialog();
  vi.useFakeTimers();
  render(<App />);
  await advance(3000);
  await advance(100);
}

/** 画面を片づけ、タイマーを本物に戻す */
export function closeApp(): void {
  cleanup();
  vi.useRealTimers();
}

/** メッセージの一覧（role=log）に出ている文字（空白の並びは1つにまとめる） */
export const logText = () => (screen.getByRole('log').textContent ?? '').replace(/\s+/g, ' ');

/** いま開いているダイアログ */
export function openDialog(): HTMLElement {
  const dialog = document.querySelector<HTMLElement>('dialog[open]');
  if (!dialog) throw new Error('開いているダイアログがありません');
  return dialog;
}
