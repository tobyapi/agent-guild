// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMarkdownRenderer } from '../model/markdown';
import { renderDiagram } from '../model/mermaid';
import { sanitizeHtml } from '../model/sanitize';
import { MessageBody } from './MessageBody';

vi.mock('../api', () => ({ chatApi: { openUrl: vi.fn() } }));
vi.mock('../model/mermaid', () => ({ renderDiagram: vi.fn() }));

const markdown = createMarkdownRenderer([]);
const renderBody = (content: string) => sanitizeHtml(markdown(content));
const writeText = vi.fn((text: string) => Promise.resolve(text));

beforeEach(() => {
  vi.resetAllMocks();
  writeText.mockImplementation((text) => Promise.resolve(text));
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
});
afterEach(cleanup);

describe('MessageBody', () => {
  it('コードブロックにコピーのボタンを差し込み、押すと中身をコピーする', async () => {
    const view = render(<MessageBody content={'```ts\nconst a = "<b>";\n```'} render={renderBody} />);
    expect(view.container.querySelector('.hljs-keyword')?.textContent).toBe('const');
    fireEvent.click(screen.getByRole('button', { name: 'コピー' }));
    expect(writeText).toHaveBeenCalledWith('const a = "<b>";');
    expect(await screen.findByText('コピーしました')).toBeTruthy();
  });

  it('閉じた mermaid は図にしてソースを畳み、コピーは残す', async () => {
    vi.mocked(renderDiagram).mockResolvedValue({ ok: true, svg: '<svg data-testid="diagram"></svg>' });
    const view = render(<MessageBody content={'```mermaid\ngraph TD\n  A-->B\n```'} render={renderBody} />);
    expect(await screen.findByTestId('diagram')).toBeTruthy();
    expect(renderDiagram).toHaveBeenCalledWith('graph TD\n  A-->B', 'dark');
    expect(view.container.querySelector('[data-embed="mermaid"]')?.hasAttribute('data-rendered')).toBe(true);
    expect(screen.getByRole('button', { name: 'コピー' })).toBeTruthy();
  });

  it('描けない図はソースを見せたままにし、書きかけの mermaid は描こうとしない', async () => {
    vi.mocked(renderDiagram).mockResolvedValue({ ok: false });
    const view = render(<MessageBody content={'```mermaid\nこれは図ではない\n```'} render={renderBody} />);
    expect(await screen.findByText(/図を描けませんでした/)).toBeTruthy();
    expect(view.container.querySelector('[data-rendered]')).toBeNull();
    expect(view.container.querySelector('pre')?.textContent).toContain('これは図ではない');

    vi.mocked(renderDiagram).mockClear();
    view.rerender(<MessageBody content={'```mermaid\ngraph TD\n  A-->'} render={renderBody} />);
    expect(view.container.querySelector('pre')?.textContent).toContain('A-->');
    expect(renderDiagram).not.toHaveBeenCalled();
  });

  it('外の画像は押すまで読み込まず、読み込んだ画像は押すと大きく見られる', () => {
    Object.assign(HTMLDialogElement.prototype, { showModal: vi.fn() });
    const view = render(<MessageBody content="![図](https://img.example.com/a.png)" render={renderBody} />);
    expect(view.container.querySelector('img')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /img\.example\.com から読み込む/ }));
    const image = view.container.querySelector('img');
    expect(image?.getAttribute('src')).toBe('https://img.example.com/a.png');
    expect(image?.getAttribute('referrerpolicy')).toBe('no-referrer');
    fireEvent.click(screen.getByRole('button', { name: '図 を大きく表示' }));
    expect(view.container.querySelector('dialog img')?.getAttribute('src')).toBe('https://img.example.com/a.png');
  });

  it('外の動画も押してから読み込み、data: の画像はそのまま見せる', () => {
    const content = '![録画](https://v.example.com/a.mp4)\n\n![紋](data:image/png;base64,iVBORw0KGgo=)';
    const view = render(<MessageBody content={content} render={renderBody} />);
    expect(view.container.querySelector('video')).toBeNull();
    expect(view.container.querySelector('img')?.getAttribute('alt')).toBe('紋');
    fireEvent.click(screen.getByRole('button', { name: /v\.example\.com から読み込む/ }));
    expect(view.container.querySelector('video')?.getAttribute('src')).toBe('https://v.example.com/a.mp4');
  });

  it('生の HTML は要素にせず、差し込み口の属性を本文から作らせない', () => {
    const content =
      '<span data-embed="image" data-src="https://evil.example/x.png"></span><img src=x onerror=alert(1)>';
    const view = render(<MessageBody content={content} render={renderBody} />);
    expect(view.container.querySelector('[data-embed], img')).toBeNull();
    expect(view.container.textContent).toContain('data-embed');
  });
});
