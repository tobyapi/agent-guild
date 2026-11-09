// モックの添付（画像・ファイル）: 検証（Rust の guild-domain attachment.rs と同じ規則）と、data URL での保存。
import {
  IMAGE_MEDIA_TYPES,
  MAX_ATTACHMENTS,
  MAX_FILE_BYTES,
  MAX_IMAGE_BYTES,
  MAX_TOTAL_ATTACHMENT_BYTES,
} from '@/shared/lib/limits';
import type { Attachment, AttachmentInput, Message } from '@/shared/types/domain';
import { fail, type MockCore } from './runtime';

const MEDIA_TYPE = /^[\w!#$&^.+-]+\/[\w!#$&^.+-]+$/;

/** base64 の長さから中身のバイト数を出す */
export function decodedSize(data: string): number {
  const padding = data.endsWith('==') ? 2 : data.endsWith('=') ? 1 : 0;
  return Math.floor((data.length * 3) / 4) - padding;
}

const invalid = (message: string): never => fail('validation', message, 'attachments');

function validate(inputs: readonly AttachmentInput[]): void {
  if (inputs.length > MAX_ATTACHMENTS) invalid(`添付は1回に${MAX_ATTACHMENTS}個までです`);
  for (const input of inputs) {
    if (!MEDIA_TYPE.test(input.mediaType) || input.mediaType.length > 100) invalid('ファイルの種類が正しくありません');
    const size = decodedSize(input.data);
    const image = IMAGE_MEDIA_TYPES.includes(input.mediaType);
    if (size === 0) invalid('空のファイルは添付できません');
    if (image && size > MAX_IMAGE_BYTES) invalid('画像は1枚 5MB までです');
    if (!image && size > MAX_FILE_BYTES) invalid('ファイルは1つ 10MB までです');
  }
  const total = inputs.reduce((sum, input) => sum + decodedSize(input.data), 0);
  if (total > MAX_TOTAL_ATTACHMENT_BYTES) invalid('添付の合計は 30MB までです');
}

/** 検証してから中身を data URL で持ち、発言に持たせるメタデータを返す */
export function storeAttachments(core: MockCore, inputs: readonly AttachmentInput[]): Attachment[] {
  validate(inputs);
  return inputs.map((input) => {
    const id = core.env.newId();
    core.state.attachmentData[id] = `data:${input.mediaType};base64,${input.data}`;
    const base = input.name.split(/[\\/]/).pop()?.trim() ?? '';
    const fallback = IMAGE_MEDIA_TYPES.includes(input.mediaType) ? 'image.png' : 'file.bin';
    return { id, name: base === '' ? fallback : base, mediaType: input.mediaType, size: decodedSize(input.data) };
  });
}

/** 発言に添えたものの data URL（なければ not_found） */
export function attachmentData(core: MockCore, messageId: string, attachmentId: string): string {
  const message: Message | undefined = core.state.messages.find((item) => item.id === messageId);
  if (!message) fail('not_found', '発言が見つかりません');
  const known = message.attachments.some((attachment) => attachment.id === attachmentId);
  const data = known ? core.state.attachmentData[attachmentId] : undefined;
  return data ?? fail('not_found', '添付が見つかりません');
}
