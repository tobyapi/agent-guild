import { describe, expect, it } from 'vitest';
import { backendInfo } from '@/shared/lib/backends.test-support';
import { drawingBackends, offersFrameGeneration } from './generation';

const painter = backendInfo({ id: 'painter', frameGeneration: true, status: 'ready' });
const signedOut = backendInfo({ id: 'signed-out', frameGeneration: true, status: 'needs_auth' });
const plain = backendInfo({ id: 'plain', frameGeneration: false, status: 'ready' });

describe('枠を描けるバックエンド', () => {
  it('枠の生成を申告していて、使える状態のものだけを選ぶ', () => {
    expect(drawingBackends([plain, signedOut, painter]).map((backend) => backend.id)).toEqual(['painter']);
  });

  it('申告するバックエンドが1つもなければ、生成の操作を出さない', () => {
    expect(offersFrameGeneration([plain])).toBe(false);
    expect(offersFrameGeneration([plain, signedOut])).toBe(true);
    expect(offersFrameGeneration([])).toBe(false);
  });
});
