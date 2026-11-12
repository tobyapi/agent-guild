import { useId } from 'react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cx } from '@/shared/lib/cx';
import { IconButton } from './Button';
import { Icon } from './Icon';
import styles from './SideSection.module.css';
import { t } from './i18n';

export interface SideSectionProps {
  title: ReactNode;
  /** 見出しの先頭の印（区分の菱など） */
  mark?: ReactNode;
  count?: number;
  /** 見出しの右端の「＋」（区画のホバーかフォーカス中だけ見せる） */
  onAdd?: () => void;
  addLabel?: string;
  /** 中身が空のときの 1 行（例: 「まだ誰もいません」） */
  emptyText?: string;
  isEmpty?: boolean;
  children?: ReactNode;
}

/** サイドバー・メンバーパネルの区画（docs/ui-design.md §5.2） */
export function SideSection({ title, mark, count, onAdd, addLabel, emptyText, isEmpty, children }: SideSectionProps) {
  const headingId = useId();
  return (
    <section className={styles.section} aria-labelledby={headingId}>
      <div className={styles.head}>
        {mark}
        <h2 id={headingId} className={styles.title}>
          {title}
        </h2>
        {count !== undefined && <span className={styles.count}>{count}</span>}
        {onAdd && (
          <IconButton className={styles.add} label={addLabel ?? t('add')} onClick={onAdd}>
            <Icon name="plus" />
          </IconButton>
        )}
      </div>
      {isEmpty && emptyText ? <p className={styles.empty}>{emptyText}</p> : <ul className={styles.list}>{children}</ul>}
    </section>
  );
}

export interface SideRowProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** 先頭（# やアバター）。24px 幅に収める */
  leading: ReactNode;
  label: ReactNode;
  /** 右端（灯・札など） */
  trailing?: ReactNode;
  /** 今いる場所（aria-current="page"） */
  current?: boolean;
  /** 動いている（名前を primary にする） */
  active?: boolean;
  /** 使えない状態（名前を muted にする） */
  dimmed?: boolean;
}

/** 区画の中の1行（チャンネルもエージェントも同じ形）。li の中に置く */
export function SideRow({ leading, label, trailing, current, active, dimmed, className, ...rest }: SideRowProps) {
  return (
    <button
      type="button"
      className={cx(styles.row, className)}
      aria-current={current ? 'page' : undefined}
      data-active={active ? '' : undefined}
      data-dimmed={dimmed ? '' : undefined}
      {...rest}
    >
      <span className={styles.leading}>{leading}</span>
      <span className={styles.label}>{label}</span>
      {trailing}
    </button>
  );
}
