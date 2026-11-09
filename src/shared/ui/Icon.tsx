import { cx } from '@/shared/lib/cx';
import styles from './Icon.module.css';

// 24x24 の線画アイコン。色は文字色（currentColor）、大きさは文字サイズ（1em）に従う。
const PATHS = {
  plus: 'M12 5v14M5 12h14',
  close: 'M6 6l12 12M18 6L6 18',
  settings:
    'M4 6h8M16 6h4M4 12h2M10 12h10M4 18h10M18 18h2M12 6a2 2 0 1 0 4 0a2 2 0 1 0-4 0M6 12a2 2 0 1 0 4 0a2 2 0 1 0-4 0M14 18a2 2 0 1 0 4 0a2 2 0 1 0-4 0',
  users:
    'M16 20v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1M9 11a4 4 0 1 0 0-8a4 4 0 0 0 0 8M22 20v-1a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8',
  stop: 'M7 7h10v10H7z',
  edit: 'M4 20h4L19 9l-4-4L4 16v4zM14 6l4 4',
  trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
  folder: 'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
  send: 'M22 2L11 13M22 2l-7 20-4-9-9-4z',
  hash: 'M5 9h14M5 15h14M10 4L8 20M16 4l-2 16',
  image: 'M4 5h16v14H4zM4 16l5-5 4 4 2-2 5 5M14 9.5a1.5 1.5 0 1 0 3 0a1.5 1.5 0 1 0-3 0',
  file: 'M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zM14 3v5h5',
  paperclip: 'M21 11l-9 9a6 6 0 0 1-8.5-8.5l9-9a4 4 0 0 1 5.7 5.7l-9 9a2 2 0 0 1-2.9-2.9l8.5-8.5',
  play: 'M7 5l12 7-12 7z',
  chevron: 'M6 9l6 6 6-6',
  check: 'M5 12l5 5 9-10',
  alert: 'M12 9v4M12 17h.01M10.3 3.9L2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z',
  refresh: 'M20 11a8 8 0 0 0-14.9-3.5M4 4v4h4M4 13a8 8 0 0 0 14.9 3.5M20 20v-4h-4',
  info: 'M12 22a10 10 0 1 0 0-20a10 10 0 0 0 0 20zM12 16v-4M12 8h.01',
  join: 'M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 16l4-4-4-4M14 12H4',
  diamond: 'M12 7.5 16.5 12 12 16.5 7.5 12Z',
  arrowDown: 'M12 5v14M6 13l6 6 6-6',
  arrowUp: 'M12 19V5M6 11l6-6 6 6',
  minus: 'M6 12h12',
  return: 'M9 14 4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3',
  link: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
  eye: 'M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6a3 3 0 0 0 0 6z',
} as const;

export type IconName = keyof typeof PATHS;

/** 塗りつぶして描くアイコン */
const FILLED: ReadonlySet<IconName> = new Set<IconName>(['stop', 'play']);

export interface IconProps {
  name: IconName;
  className?: string;
}

/** 装飾用のアイコン（読み上げない）。意味はボタンのラベルなどで伝える */
export function Icon({ name, className }: IconProps) {
  return (
    <svg
      className={cx(styles.icon, FILLED.has(name) && styles.filled, className)}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
