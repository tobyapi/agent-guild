import { describe, expect, it, vi } from 'vitest';
import { handlePost, POST_TOOL, postServer } from './post.ts';

describe('途中の投稿ツール', () => {
  it('前後の空白を除いて投稿し、作業を続けるよう返す', () => {
    const onPost = vi.fn();
    const result = handlePost(onPost, '  進捗: 半分まで終わりました\n');
    expect(onPost).toHaveBeenCalledWith('進捗: 半分まで終わりました');
    expect(result).toEqual({ content: [{ type: 'text', text: '投稿しました。作業を続けてください。' }] });
  });

  it('空の文章は投稿せず、エラーとして返す', () => {
    const onPost = vi.fn();
    expect(handlePost(onPost, ' \n ')).toMatchObject({ isError: true });
    expect(onPost).not.toHaveBeenCalled();
  });

  it('guild サーバーの post ツールとして登録する', () => {
    expect(POST_TOOL).toBe('mcp__guild__post');
    expect(postServer(vi.fn())).toMatchObject({ type: 'sdk', name: 'guild' });
  });
});
