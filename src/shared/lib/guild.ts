// ギルドの名前と紋の規則（Rust の guild-domain guild.rs と同じ）。UI の事前検査とモックの両方が使う。
import type { CrestColor, CrestShape, GuildProfile } from '@/shared/types/domain';
import { textLength } from './validation';

/** ギルド名の最大文字数（コードポイント。エージェント名と同じ） */
export const GUILD_NAME_MAX = 32;

/** 選べる紋の形（並びは選ぶ画面の順。先頭が既定） */
export const CREST_SHAPES: readonly CrestShape[] = ['diamond', 'shield', 'circle', 'hexagon', 'star'];

/** 選べる紋の色（先頭が既定 = これまでの見た目） */
export const CREST_COLORS: readonly CrestColor[] = ['default', 'gold', 'crimson', 'jade', 'azure', 'violet'];

/** 名前が空で、紋も既定のギルド（未設定と同じ） */
export const DEFAULT_GUILD: GuildProfile = { name: '', crest: { shape: 'diamond', color: 'default' } };

/** 保存する形に整える（名前の前後の空白を除く） */
export function cleanGuild(guild: GuildProfile): GuildProfile {
  return { name: guild.name.trim(), crest: { ...guild.crest } };
}

/** 名前が長すぎるか（空はアプリ名を使う印なので許す） */
export function guildNameTooLong(name: string): boolean {
  return textLength(name.trim()) > GUILD_NAME_MAX;
}

/** 形と色が候補の中にあるか（候補にない値は既定にする。新しい版が足した値・壊れた値への備え） */
export function knownCrest(guild: GuildProfile): GuildProfile {
  const shape = CREST_SHAPES.includes(guild.crest.shape) ? guild.crest.shape : DEFAULT_GUILD.crest.shape;
  const color = CREST_COLORS.includes(guild.crest.color) ? guild.crest.color : DEFAULT_GUILD.crest.color;
  return { name: guild.name, crest: { shape, color } };
}
