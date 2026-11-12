import type { KeyboardEvent } from 'react';
import { Avatar } from '@/shared/ui';
import type { FrameChoice } from '../model/catalog';
import styles from './FramePicker.module.css';

export interface FrameTileProps {
  choice: FrameChoice;
  /** 名前（読み上げとツールチップ） */
  title: string;
  checked: boolean;
  /** 見本に使う、いまのアバター */
  avatar: { avatar: string; name: string; color: string; human?: boolean };
  onSelect: () => void;
  onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void;
  /** ホバー・フォーカスで、下の見出しに名前を出す */
  onShow: () => void;
}

/** 枠の選択肢1つ（いまのアバターに、その枠を重ねた見本） */
export function FrameTile({ choice, title, checked, avatar, onSelect, onKeyDown, onShow }: FrameTileProps) {
  return (
    <button
      type="button"
      role="radio"
      className={styles.tile}
      title={title}
      aria-label={title}
      aria-checked={checked}
      aria-busy={choice.loading || undefined}
      tabIndex={checked ? 0 : -1}
      onClick={onSelect}
      onKeyDown={onKeyDown}
      onFocus={onShow}
      onMouseEnter={onShow}
    >
      <Avatar {...avatar} size="sm" frame={choice.frame} />
    </button>
  );
}
