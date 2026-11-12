// 発言者の表示（人間・エージェント・削除済みのエージェント・不明）。
import { HUMAN_ID } from '@/shared/types/domain';
import type { Agent, Profile } from '@/shared/types/domain';
import { t } from '../i18n';

export interface AuthorView {
  name: string;
  avatar: string;
  color: string;
  /** 札に出す先頭のタグ。人間・削除済み・不明・タグのないエージェントは null（札を出さない） */
  tag: string | null;
  /** バックエンドの札を出すときの id（人間・削除済み・不明は null） */
  backend: string | null;
  human: boolean;
  deleted: boolean;
}

const unknown = (): AuthorView => ({
  name: t('unknownMember'),
  avatar: '',
  color: '',
  tag: null,
  backend: null,
  human: false,
  deleted: true,
});

/** 発言者 ID → 表示。agents には削除済みも含める（過去の発言の作者表示に使う） */
export function createAuthorResolver(agents: readonly Agent[], me: Profile): (authorId: string) => AuthorView {
  const byId = new Map(agents.map((agent) => [agent.id, agent]));
  return (authorId) => {
    if (authorId === HUMAN_ID) {
      return {
        name: me.name,
        avatar: me.avatar,
        color: me.color,
        tag: null,
        backend: null,
        human: true,
        deleted: false,
      };
    }
    const agent = byId.get(authorId);
    if (!agent) return unknown();
    const deleted = agent.deletedAt !== null;
    return {
      name: agent.name,
      avatar: agent.avatar,
      color: agent.color,
      tag: deleted ? null : (agent.tags[0] ?? null),
      backend: deleted ? null : agent.backend,
      human: false,
      deleted,
    };
  };
}
