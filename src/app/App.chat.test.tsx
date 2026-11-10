// @vitest-environment jsdom
// 画面の振る舞い（チャット）: 読み込んだ発言の表示と、送信 → 自分の発言 → 呼んだエージェントの返答。
// アプリ全体をモックのバックエンドで動かす。テストは同じ起動の続きとして順に動く（appFlow.test-support.tsx）。
import { fireEvent, screen, within } from '@testing-library/react';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { advance, bootApp, closeApp, logText, openDialog } from './appFlow.test-support';

beforeAll(bootApp);
afterAll(closeApp);

const articles = () => within(screen.getByRole('log')).getAllByRole('article');

/** いちばん新しい発言 */
function lastArticle(): HTMLElement {
  const last = articles().at(-1);
  if (!last) throw new Error('発言がありません');
  return last;
}

it('起動すると最初のチャンネルの発言が出る。割り振りの発言は、tasks ブロックの代わりにカードで出る', () => {
  expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('#ロビー');
  expect(articles().length).toBeGreaterThan(0);
  expect(logText()).toMatch(/割り振り\s*\d+ 件中 \d+ 件完了/);
  expect(logText()).not.toMatch(/```\s*tasks/i);
});

it('チャンネルヘッダーの運用統計で、既存の割り振りを表示する', async () => {
  fireEvent.click(screen.getByRole('button', { name: '運用統計' }));
  await advance(500);
  const dialog = within(openDialog());
  expect(dialog.getByRole('heading', { name: '運用統計' })).toBeTruthy();
  expect(dialog.getByText('# ロビー · 全期間')).toBeTruthy();
  expect(dialog.getByText('50%')).toBeTruthy();
  expect(dialog.getByText('1 / 2 件')).toBeTruthy();
  expect(dialog.getByText(/まだ実行記録がありません/)).toBeTruthy();
  fireEvent.click(dialog.getByRole('button', { name: '閉じる' }));
});

it('送信すると入力欄が空になって自分の発言が出て、呼んだエージェントが返答する', async () => {
  const before = articles().length;
  const box = screen.getByRole<HTMLTextAreaElement>('textbox', { name: '#ロビー へのメッセージ' });
  fireEvent.change(box, { target: { value: '@ハル 競合を3つ調べて' } });
  fireEvent.click(screen.getByRole('button', { name: '送信' }));
  await advance(300);

  expect(box.value).toBe('');
  expect(articles()).toHaveLength(before + 1);
  expect(lastArticle().textContent).toContain('競合を3つ調べて');
  expect(within(lastArticle()).getByText('@ハル').dataset.kind).toBe('agent');

  await advance(15000);
  expect(articles().length).toBeGreaterThanOrEqual(before + 2);
  expect(within(lastArticle()).getByText('ハル')).toBeTruthy();
});
