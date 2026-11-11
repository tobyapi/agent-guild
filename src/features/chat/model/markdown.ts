// メッセージ本文（Markdown）を HTML にする。表示する前に必ず sanitizeHtml を通すこと。
// - 生の HTML は文字としてそのまま見せる（タグとして解釈しない）
// - リンクは http / https だけ（クリックすると OS の既定のブラウザで開く）
// - 画像・動画とコードブロックは、あとから部品を差し込む口にする（markdownEmbeds.ts）。画像はここでは読み込まない
// - 「@名前」はメンションのチップにする（コードの中は対象外。NFKC・大文字小文字無視、名前の長い順に照合）
import { Marked } from 'marked';
import type { Tokens, TokenizerAndRendererExtension } from 'marked';
import { accentStyleText } from '@/shared/lib/accent';
import { escapeHtml } from '@/shared/lib/html';
import { matchMentionAt, sortByNameLength } from '@/shared/lib/mentions';
import type { MentionTarget } from '@/shared/lib/mentions';
import { codeBlockHtml, mediaHtml } from './markdownEmbeds';

/** チップにする相手。kind は data-kind、accent は色（--kind-<accent> の CSS 変数。null なら既定の色） */
export interface ChipTarget extends MentionTarget {
  kind: 'agent' | 'human' | 'deleted';
  accent: string | null;
}

const SAFE_URL = /^https?:/i;
const MENTION_MARK = /[@＠]/;

interface MentionToken extends Tokens.Generic {
  type: 'mention';
  target: ChipTarget;
}

function externalLink(href: string, label: string, title?: string | null): string {
  const titleAttribute = title ? ` title="${escapeHtml(title)}"` : '';
  return `<a href="${escapeHtml(href)}"${titleAttribute} target="_blank" rel="noopener noreferrer">${label}</a>`;
}

/** 色は値で分岐せず、CSS 変数を組み立てて渡す（色が決まらなければ渡さず、既定のチップの色にする） */
function chipStyle(accent: string | null): string {
  const style = accentStyleText(accent);
  return style === '' ? '' : ` style="${style}"`;
}

function chip(target: ChipTarget): string {
  const title = target.kind === 'deleted' ? ' title="削除済みのエージェント"' : '';
  const attributes = `class="mention" data-kind="${target.kind}" data-mention-id="${escapeHtml(target.id)}"${chipStyle(target.accent)}${title}`;
  return `<span ${attributes}>@${escapeHtml(target.name)}</span>`;
}

function mentionExtension(targets: readonly ChipTarget[]): TokenizerAndRendererExtension {
  const sorted = sortByNameLength(targets);
  return {
    name: 'mention',
    level: 'inline',
    start(src) {
      const index = src.search(MENTION_MARK);
      return index < 0 ? undefined : index;
    },
    tokenizer(src) {
      const target = matchMentionAt(src, sorted);
      if (!target) return undefined;
      const token: MentionToken = { type: 'mention', raw: src.slice(0, target.name.length + 1), target };
      return token;
    },
    renderer: (token) => chip((token as MentionToken).target),
  };
}

/** チップにする相手を受け取り、本文を HTML にする関数を返す（相手が変わるまで使い回す） */
export function createMarkdownRenderer(targets: readonly ChipTarget[]): (markdown: string) => string {
  const marked = new Marked({
    gfm: true,
    breaks: true,
    async: false,
    extensions: [mentionExtension(targets)],
    renderer: {
      html: ({ text }) => escapeHtml(text),
      link({ href, title, tokens }) {
        const label = this.parser.parseInline(tokens);
        return SAFE_URL.test(href) ? externalLink(href, label, title) : label;
      },
      code: ({ text, lang, raw }) => codeBlockHtml(text, lang, raw),
      image({ href, text }) {
        const embed = mediaHtml(href, text);
        if (embed !== null) return embed;
        const label = `画像: ${escapeHtml(text || href)}`;
        return SAFE_URL.test(href) ? externalLink(href, label) : label;
      },
    },
  });
  return (markdown) => marked.parse(markdown, { async: false });
}
