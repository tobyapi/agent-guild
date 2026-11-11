// 作業の途中でチャットに投稿するための、プロセス内の MCP ツール（mcp__guild__post）。
// 投稿は RunContext.onPost で Rust へ送る（Rust が途中経過の発言として保存する。振り分けはしない）。

import { createSdkMcpServer, tool, type McpSdkServerConfigWithInstance } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';

/** mcpServers のキー（ツール名の接頭辞になる） */
export const POST_SERVER = 'guild';
/** allowedTools に入れる名前 */
export const POST_TOOL = `mcp__${POST_SERVER}__post`;

const DESCRIPTION =
  '作業の途中で、今いるチャンネルにメッセージを投稿します（進捗状況や困っていること）。' +
  '投稿しても作業は続きます。最後の返答は、これまでどおり普通に書いてください。ここでのメンションは相手に通知されません。';

/** guild サーバーに足せる道具（SDK の tool() が返すもの） */
export type GuildTool = NonNullable<Parameters<typeof createSdkMcpServer>[0]['tools']>[number];

/** モデルに返すツールの結果（MCP の CallToolResult の形） */
export interface PostResult {
  [key: string]: unknown;
  content: { type: 'text'; text: string }[];
  isError?: boolean;
}

/** 文章を投稿して短い確認を返す（空なら投稿せずにエラーを返す） */
export function handlePost(onPost: (text: string) => void, text: string): PostResult {
  const trimmed = text.trim();
  if (trimmed === '') return { content: [{ type: 'text', text: '投稿する文章が空です。' }], isError: true };
  onPost(trimmed);
  return { content: [{ type: 'text', text: '投稿しました。作業を続けてください。' }] };
}

/** guild サーバー。投稿の道具と、渡されたほかの道具（隔離の中で動くコマンド。command.ts）を持つ */
export function postServer(
  onPost: (text: string) => void,
  extraTools: readonly GuildTool[] = [],
): McpSdkServerConfigWithInstance {
  const schema = { text: z.string().describe('投稿する文章（Markdown が使えます）') };
  const post = tool('post', DESCRIPTION, schema, ({ text }) => Promise.resolve(handlePost(onPost, text)));
  return createSdkMcpServer({ name: POST_SERVER, version: '1.0.0', tools: [post, ...extraTools], alwaysLoad: true });
}
