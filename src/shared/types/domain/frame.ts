/**
 * 生成したアイコンの枠（ギルドのデータ。Snapshot.frames）。id は `custom:<ID>`。絵の種類は kind:
 * - `svg`: 以前の版が生成した枠。svg は Rust が許可リストで検査して書き直したもの（React も描く前にもう一度消毒する）
 * - `png`: 画像の生成で描いた枠。Rust が背景と中央の穴を透明にして整えた PNG で、中身は `get_frame_image` で取る
 */
export type CustomFrame = CustomSvgFrame | CustomPngFrame;

interface CustomFrameBase {
  id: string;
  name: string;
  createdAt: number;
}

export interface CustomSvgFrame extends CustomFrameBase {
  kind: 'svg';
  svg: string;
}

export interface CustomPngFrame extends CustomFrameBase {
  kind: 'png';
}
