// domain のギルドのプロフィール（名前と紋）のスキーマ。
import type { CrestColor, CrestShape, CustomPngFrame, CustomSvgFrame, GuildCrest, GuildProfile } from '../domain';
import { anyOf, number, objectOf, oneOf, string } from '../schema';
import type { Schema } from '../schema';

export const crestShapeEnum = oneOf<CrestShape>({
  diamond: true,
  shield: true,
  circle: true,
  hexagon: true,
  star: true,
});

export const crestColorEnum = oneOf<CrestColor>({
  default: true,
  gold: true,
  crimson: true,
  jade: true,
  azure: true,
  violet: true,
});

export const guildCrestSchema = { shape: crestShapeEnum, color: crestColorEnum } satisfies Schema<GuildCrest>;

const customSvgFrameSchema = {
  id: string,
  name: string,
  kind: oneOf<'svg'>({ svg: true }),
  svg: string,
  createdAt: number,
} satisfies Schema<CustomSvgFrame>;

const customPngFrameSchema = {
  id: string,
  name: string,
  kind: oneOf<'png'>({ png: true }),
  createdAt: number,
} satisfies Schema<CustomPngFrame>;

/** 生成したアイコンの枠（ギルドのデータ。kind で形が決まる） */
export const customFrameSchema = anyOf(objectOf(customSvgFrameSchema), objectOf(customPngFrameSchema));

export const guildProfileSchema = { name: string, crest: objectOf(guildCrestSchema) } satisfies Schema<GuildProfile>;
