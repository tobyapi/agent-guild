// 紋の形（viewBox 0 0 24 24）。どれも細い輪郭の枠と、真ん中の灯（core）でできている。
// 枠はおよそ 2.8〜21.2 に収め、灯は枠の内側に余白を残す大きさにする（並べても大きさがそろって見えるように）。
import type { CrestShape } from '@/shared/types/domain';

export interface CrestGeometry {
  /** 枠の輪郭（閉じた path） */
  frame: string;
  /** 灯の中心と半径 */
  core: { cx: number; cy: number; r: number };
}

export const CREST_GEOMETRY: Readonly<Record<CrestShape, CrestGeometry>> = {
  /** 菱（既定。これまでの紋） */
  diamond: { frame: 'M12 2.8 21.2 12 12 21.2 2.8 12Z', core: { cx: 12, cy: 12, r: 3.3 } },
  /** 盾 */
  shield: {
    frame: 'M12 2.8 19.6 5.6V11.2C19.6 15.9 16.4 19.4 12 21.2 7.6 19.4 4.4 15.9 4.4 11.2V5.6Z',
    core: { cx: 12, cy: 11.4, r: 3.1 },
  },
  /** 円（月） */
  circle: { frame: 'M12 3.2A8.8 8.8 0 1 1 12 20.8 8.8 8.8 0 1 1 12 3.2Z', core: { cx: 12, cy: 12, r: 3.3 } },
  /** 六角 */
  hexagon: { frame: 'M12 2.8 19.97 7.4V16.6L12 21.2 4.03 16.6V7.4Z', core: { cx: 12, cy: 12, r: 3.3 } },
  /** 星 */
  star: {
    frame: 'M12 2.8 14.88 8.64 21.32 9.57 16.66 14.11 17.76 20.53 12 17.5 6.24 20.53 7.34 14.11 2.68 9.57 9.12 8.64Z',
    core: { cx: 12, cy: 12.6, r: 2.5 },
  },
};
