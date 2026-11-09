// Claude に渡す入力: 画像がなければプロンプトの文字列。あれば画像（base64）と本文を1つのユーザーメッセージにして、
// 1件だけ流す入力（終わると SDK が入力を閉じ、その返答で実行が終わる）として渡す。

import { readFile } from 'node:fs/promises';
import { Readable } from 'node:stream';
import type { SDKUserMessage } from '@anthropic-ai/claude-agent-sdk';
import type { ImagePayload } from '../../protocol.ts';
import { BackendError } from '../types.ts';

const MEDIA_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'] as const;
type ImageMediaType = (typeof MEDIA_TYPES)[number];

const isImageMediaType = (value: string): value is ImageMediaType => MEDIA_TYPES.some((type) => type === value);

async function imageBlock(image: ImagePayload) {
  const { mediaType } = image;
  if (!isImageMediaType(mediaType)) throw new BackendError('bad_request', `対応していない画像の形式です: ${mediaType}`);
  let data: string;
  try {
    data = (await readFile(image.path)).toString('base64');
  } catch {
    throw new BackendError('bad_request', `添付画像を読めませんでした（${image.path}）`);
  }
  return { type: 'image' as const, source: { type: 'base64' as const, media_type: mediaType, data } };
}

/** 画像（発言の順）と本文の1つのユーザーメッセージ */
export async function userMessage(prompt: string, images: readonly ImagePayload[]): Promise<SDKUserMessage> {
  const blocks = await Promise.all(images.map(imageBlock));
  return {
    type: 'user',
    message: { role: 'user', content: [...blocks, { type: 'text', text: prompt }] },
    parent_tool_use_id: null,
  };
}

/** query() の prompt。画像は先に読み、読めなければ実行を始める前に失敗する */
export async function claudePrompt(
  prompt: string,
  images: readonly ImagePayload[],
): Promise<string | AsyncIterable<SDKUserMessage>> {
  if (images.length === 0) return prompt;
  const message = await userMessage(prompt, images);
  return Readable.from([message]);
}
