// 隔離の中で動くコマンドの道具（mcp__guild__run_command）。Claude 内蔵の Bash は OS の隔離に入れられないので、
// 作業者以外の役割には、Bash の代わりにこの道具を渡す（rules.ts の commandMode が sandbox のとき）。
// 実行は共通の隔離（../command-sandbox/role-command.ts）: 書けるのは作業フォルダだけで、通信はできない。

import { tool } from '@anthropic-ai/claude-agent-sdk';
import { join } from 'node:path';
import { z } from 'zod';
import { runRoleCommand } from '../command-sandbox/role-command.ts';
import { BackendError, type RunRequest } from '../types.ts';
import { PLUGIN_NAME } from './plugin.ts';
import { POST_SERVER, type PostResult } from './post.ts';

/** allowedTools に入れる名前（投稿と同じ guild サーバーの道具） */
export const COMMAND_TOOL = `mcp__${POST_SERVER}__run_command`;

/** 1回のコマンドの時間切れ（テストやビルドを待てる長さ） */
const COMMAND_TIMEOUT_MS = 120_000;
/** 出力の上限（超えたら止めて、エラーとして返す） */
const OUTPUT_LIMIT = 64 * 1024;

const DESCRIPTION =
  'Windows PowerShell のコマンドを、作業フォルダで実行します（例: git status、npm test、node script.js、Get-ChildItem）。' +
  '隔離の中で動くので、ネットワークは使えません。書き込めるのは作業フォルダの中だけで、読めるのは作業フォルダと、' +
  '相談元などの読み取りフォルダだけです（そのほかの場所のファイルは Read・Grep・Glob で読んでください）。' +
  'ホームフォルダは隔離の中専用で、利用者の設定（git の名前とメールアドレスなど）は入っていません。' +
  '1回 120 秒まで、出力は 64KB までです。';

const failed = (text: string): PostResult => ({ content: [{ type: 'text', text }], isError: true });

/** コマンドを隔離の中で動かし、終了コードと出力を返す（動かせなかったときはエラーとして返す。人間には聞かない） */
export async function handleCommand(request: RunRequest, command: string, signal: AbortSignal): Promise<PostResult> {
  if (command.trim() === '') return failed('実行するコマンドが空です。');
  try {
    const result = await runRoleCommand(request, command, {
      signal,
      timeoutMs: COMMAND_TIMEOUT_MS,
      outputLimit: OUTPUT_LIMIT,
      // スキルの付属ファイル（スクリプトなど）も読めるようにする
      extraReadable: [join(request.stateDir, PLUGIN_NAME)],
    });
    const match = /^exit=(-?\d+|null)\n([\s\S]*)$/.exec(result);
    const output = match?.[2]?.trim() ?? '';
    return { content: [{ type: 'text', text: `終了コード: ${match?.[1] ?? '不明'}\n${output || '（出力なし）'}` }] };
  } catch (error) {
    const reason = error instanceof BackendError ? error.message : '隔離の中で起動できませんでした';
    return failed(`コマンドを実行できませんでした: ${reason}`);
  }
}

/** guild サーバーに足す道具の定義 */
export function commandTool(request: RunRequest, signal: AbortSignal) {
  const schema = { command: z.string().describe('実行する Windows PowerShell のコマンド') };
  return tool('run_command', DESCRIPTION, schema, ({ command }) => handleCommand(request, command, signal));
}
