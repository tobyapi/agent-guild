import { Badge } from '@/shared/ui';
import { useTagAccent } from '../hooks/useAgents';

/** タグの塗りの札。色はそのタグを先頭に持つテンプレートの accent（一致しなければ中立） */
export function TagBadge({ tag }: { tag: string }) {
  const accent = useTagAccent(tag);
  return <Badge accent={accent}>{tag}</Badge>;
}

/** エージェントの先頭のタグの札（タグがなければ何も出さない） */
export function PrimaryTagBadge({ tags }: { tags: readonly string[] }) {
  const [tag] = tags;
  return tag === undefined ? null : <TagBadge tag={tag} />;
}
