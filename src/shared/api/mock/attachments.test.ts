import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AttachmentInput } from '@/shared/types/domain';
import { decodedSize } from './attachments';
import { createHarness } from './harness.test-support';
import { SEED_IDS } from './seedIds';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const png = (name = 'screen.png'): AttachmentInput => ({ name, mediaType: 'image/png', data: 'iVBORw0KGgo=' });
const pdf = (name = '仕様.pdf'): AttachmentInput => ({ name, mediaType: 'application/pdf', data: 'JVBERi0xLjQ=' });

describe('モックの画像・ファイルつきの発言', () => {
  it('添付だけでも送れて、画像は data URL で取り出せ、ファイルはフォルダで表示できる', async () => {
    const mock = await createHarness();
    const sent = await mock.transport.invoke('send_message', {
      channelId: SEED_IDS.lobby,
      content: ' ',
      attachments: [png(), pdf()],
    });
    expect(sent.content).toBe('');
    expect(sent.attachments.map(({ name, mediaType, size }) => [name, mediaType, size])).toEqual([
      ['screen.png', 'image/png', 8],
      ['仕様.pdf', 'application/pdf', 8],
    ]);
    const [image, file] = sent.attachments;
    if (!image || !file) throw new Error('添付がない');
    await expect(mock.transport.invoke('get_attachment', { messageId: sent.id, attachmentId: image.id })).resolves.toBe(
      'data:image/png;base64,iVBORw0KGgo=',
    );
    await expect(
      mock.transport.invoke('reveal_attachment', { messageId: sent.id, attachmentId: file.id }),
    ).resolves.toBeNull();
    await expect(
      mock.transport.invoke('reveal_attachment', { messageId: sent.id, attachmentId: 'nope' }),
    ).rejects.toMatchObject({
      code: 'not_found',
    });
  });

  it('本文も添付もない・11個以上・種類が MIME の形でないものは、それぞれの field の validation', async () => {
    const mock = await createHarness();
    const send = (content: string, attachments: AttachmentInput[]) =>
      mock.transport.invoke('send_message', { channelId: SEED_IDS.lobby, content, attachments });
    await expect(send('  ', [])).rejects.toMatchObject({ code: 'validation', field: 'content' });
    await expect(
      send(
        '見て',
        Array.from({ length: 11 }, () => pdf()),
      ),
    ).rejects.toMatchObject({ field: 'attachments' });
    await expect(send('見て', [{ ...pdf(), mediaType: 'PDF' }])).rejects.toMatchObject({ field: 'attachments' });
    await expect(send('見て', [{ ...png('a.bmp'), mediaType: 'image/bmp' }])).resolves.toMatchObject({
      content: '見て',
    });
  });

  it('base64 の長さから中身の大きさを出す', () => {
    expect([decodedSize('AQID'), decodedSize('AQI='), decodedSize('AQ==')]).toEqual([3, 2, 1]);
  });
});

describe('モックのログイン', () => {
  it('ログインを申告しているバックエンドだけ受け付け、少し後に状態の変化を知らせる', async () => {
    const mock = await createHarness();
    await mock.settle();
    const { backends } = await mock.transport.invoke('get_snapshot', {});
    expect(backends.map((backend) => [backend.id, backend.setup.login !== null])).toEqual([
      ['claude', true],
      ['codex', false],
      ['ollama', false],
    ]);
    await expect(mock.transport.invoke('login_backend', { backendId: 'codex' })).rejects.toMatchObject({
      code: 'validation',
    });
    await expect(mock.transport.invoke('login_backend', { backendId: 'nope' })).rejects.toMatchObject({
      code: 'not_found',
    });
    const before = mock.stateChanges.length;
    await expect(mock.transport.invoke('login_backend', { backendId: 'claude' })).resolves.toBeNull();
    await mock.settle();
    expect(mock.stateChanges.length).toBeGreaterThan(before);
  });
});
