import { cx } from '@/shared/lib/cx';
import styles from './Lamp.module.css';

export interface LampProps {
  /** 順番待ち（輪郭だけ・呼吸しない） */
  waiting?: boolean;
  className?: string;
}

/** 灯（動作中の印）。単独で置く 7px の灯。意味は隣の文字かツールチップで伝える */
export function Lamp({ waiting, className }: LampProps) {
  return <span className={cx(styles.lamp, waiting && styles.waiting, className)} aria-hidden="true" />;
}
