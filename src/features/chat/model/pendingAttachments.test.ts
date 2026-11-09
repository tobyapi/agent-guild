import { describe, expect, it } from 'vitest';
import { MAX_FILE_BYTES, MAX_IMAGE_BYTES, MAX_TOTAL_ATTACHMENT_BYTES } from '@/shared/lib/limits';
import {
  exceedsTotal,
  fitWithin,
  isImageType,
  isTooLargeFile,
  MAX_IMAGE_EDGE,
  mediaTypeOf,
  needsShrink,
  rejectionMessage,
  remainingSlots,
  renameFor,
  sizeLabel,
  toAttachmentInput,
} from './pendingAttachments';

describe('送信前の添付', () => {
  it('PNG・JPEG・GIF・WebP は画像として、ほかはファイルとして扱う。種類が分からなければ octet-stream', () => {
    expect(['image/png', 'image/jpeg', 'image/gif', 'image/webp'].every(isImageType)).toBe(true);
    expect(isImageType('image/bmp')).toBe(false);
    expect(mediaTypeOf({ type: 'application/pdf' })).toBe('application/pdf');
    expect(mediaTypeOf({ type: '' })).toBe('application/octet-stream');
  });

  it('1回に10個まで。画像以外は 10MB まで（画像は縮めるので大きさでは断らない）。合計は 30MB まで', () => {
    expect([0, 9, 10, 12].map(remainingSlots)).toEqual([10, 1, 0, 0]);
    expect(isTooLargeFile({ type: 'application/pdf', size: MAX_FILE_BYTES + 1 })).toBe(true);
    expect(isTooLargeFile({ type: 'image/png', size: MAX_FILE_BYTES + 1 })).toBe(false);
    expect(isTooLargeFile({ type: '', size: MAX_FILE_BYTES })).toBe(false);
    expect(exceedsTotal([{ size: MAX_TOTAL_ATTACHMENT_BYTES - 1 }], [{ size: 1 }])).toBe(false);
    expect(exceedsTotal([{ size: MAX_TOTAL_ATTACHMENT_BYTES }], [{ size: 1 }])).toBe(true);
  });

  it('5MB を超えるか、長辺が上限を超える画像だけを縮める', () => {
    expect(needsShrink(1024, 1920, 1080)).toBe(false);
    expect(needsShrink(MAX_IMAGE_BYTES + 1, 800, 600)).toBe(true);
    expect(needsShrink(1024, MAX_IMAGE_EDGE + 1, 100)).toBe(true);
  });

  it('縦横比を保って長辺を収め、拡大はしない', () => {
    expect(fitWithin(5120, 2880, 2560)).toEqual({ width: 2560, height: 1440 });
    expect(fitWithin(1000, 4000, 2000)).toEqual({ width: 500, height: 2000 });
    expect(fitWithin(800, 600, 2560)).toEqual({ width: 800, height: 600 });
    expect(fitWithin(10000, 1, 100)).toEqual({ width: 100, height: 1 });
  });

  it('画像の形式に合わせて名前の拡張子を付け替える（名前がなければ image）', () => {
    expect(renameFor('screenshot.png', 'image/jpeg')).toBe('screenshot.jpg');
    expect(renameFor('', 'image/webp')).toBe('image.webp');
    expect(renameFor('写真', 'image/png')).toBe('写真.png');
  });

  it('断った理由は、大きすぎるファイルを先に、次に数の超過を伝える', () => {
    expect(rejectionMessage({ tooLarge: 1, overflow: 2 })).toBe('ファイルは1つ 10MB までです');
    expect(rejectionMessage({ tooLarge: 0, overflow: 1 })).toBe('添付は1回に10個までです');
    expect(rejectionMessage({ tooLarge: 0, overflow: 0 })).toBeNull();
  });

  it('大きさは B・KB・MB で出し、送るのは名前・種類・base64 だけ', () => {
    expect([820, 12_800, 3_355_443].map(sizeLabel)).toEqual(['820 B', '12.5 KB', '3.2 MB']);
    const file = {
      key: 'pending-1',
      name: '仕様.pdf',
      mediaType: 'application/pdf',
      data: 'JVBERg==',
      preview: null,
      size: 4,
    };
    expect(toAttachmentInput(file)).toEqual({ name: '仕様.pdf', mediaType: 'application/pdf', data: 'JVBERg==' });
  });
});
