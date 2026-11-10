import { Icon } from '@/shared/ui';
import type { SkillSource } from '@/shared/types/domain';
import details from './SkillDetails.module.css';

/** 参照しているスキルの印: リンク（ライブラリのフォルダ）か内蔵（アプリに同梱） */
export function SourceMark({ source }: { source: SkillSource }) {
  return source.kind === 'linked' ? (
    <span className={details.linkMark}>
      <Icon name="link" />
      リンク
    </span>
  ) : (
    <span className={details.linkMark}>
      <Icon name="diamond" />
      内蔵
    </span>
  );
}
