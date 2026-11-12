/** 紋の形（既定は菱） */
export type CrestShape = 'diamond' | 'shield' | 'circle' | 'hexagon' | 'star';

/** 紋の色。default は文字の色（これまでの見た目）。色の値はトークン --crest-<色> が決める */
export type CrestColor = 'default' | 'gold' | 'crimson' | 'jade' | 'azure' | 'violet';

export interface GuildCrest {
  shape: CrestShape;
  color: CrestColor;
}

/** ギルドの名前と紋（データフォルダの DB に保存する） */
export interface GuildProfile {
  /** 空なら表示言語のアプリ名（AIギルド）を出す。前後の空白を除いて32文字まで */
  name: string;
  crest: GuildCrest;
}
