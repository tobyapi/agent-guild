// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { createMarkdownRenderer } from './markdown';
import { sanitizeHtml } from './sanitize';

function host(html: string): HTMLElement {
  const node = document.createElement('div');
  node.innerHTML = sanitizeHtml(html);
  return node;
}

describe('author color isolation marker', () => {
  it('marks only validated color and preserves its static transform', () => {
    const node = host(createMarkdownRenderer([])(':t[色]{color=red rotate=45}')).querySelector('.typeText');
    expect(node?.classList.contains('typeAuthorColor')).toBe(true);
    expect(node?.getAttribute('style')).toBe('color:red;transform:rotate(45deg)');
  });
  it('leaves ordinary styled text without a marker', () => {
    expect(host(createMarkdownRenderer([])(':t[太字]{weight=bold}')).querySelector('.typeAuthorColor')).toBeNull();
  });
  it.each([
    '<span class="typeText typeAuthorColor">forged</span>',
    '<span class="typeText typeAuthorColor" style="color:red">forged</span>',
    '<span class="typeText typeAuthorColor" data-typo-color="url(evil)">forged</span>',
    '<div class="typeAuthorColor">forged</div>',
  ])('removes forged markers: %s', (html) => {
    expect(host(html).querySelector('.typeAuthorColor')).toBeNull();
  });
  it('rebuilds a supplied marker only from validated data', () => {
    const node = host('<span class="typeText typeAuthorColor" data-typo-color="#123abc">valid</span>');
    expect(node.querySelectorAll('.typeAuthorColor')).toHaveLength(1);
    expect(node.firstElementChild?.getAttribute('style')).toBe('color:#123abc');
  });
});
