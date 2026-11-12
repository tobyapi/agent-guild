import type { GuildCrest, GuildProfile } from '@/shared/types/domain';
import { t } from '../i18n';
import { useGuildStore } from '../store';

export function useGuild(): GuildProfile {
  return useGuildStore((state) => state.guild);
}

/** いまの紋（起動中・復旧の画面では前回覚えたもの） */
export function useGuildCrest(): GuildCrest {
  return useGuildStore((state) => state.guild.crest);
}

/** 表示する名前（空ならいまの言語のアプリ名） */
export function useGuildName(): string {
  const name = useGuildStore((state) => state.guild.name);
  return name === '' ? t('defaultName') : name;
}

/** 設定ダイアログの区画の見出し（描画の中で呼ぶ） */
export function guildSectionTitle(): string {
  return t('sectionTitle');
}
