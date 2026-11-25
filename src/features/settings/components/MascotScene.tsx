import type { CSSProperties, HTMLAttributes } from 'react';
import { isImageAvatar } from '@/shared/lib/avatar';
import { currentLanguage } from '@/shared/i18n';
import type { MascotLayout, MascotPlacement } from '@/shared/theme/mascot';
import type { Scheme } from '@/shared/theme/types';
import { tAppearance as t } from '../i18n/appearance';
import styles from './MascotScene.module.css';

type Item = keyof MascotLayout;

export type MascotDragHandlers = Pick<
  HTMLAttributes<HTMLDivElement>,
  'onPointerDown' | 'onPointerMove' | 'onPointerUp' | 'onPointerCancel' | 'onLostPointerCapture'
>;

interface Props {
  avatar: string;
  layout: MascotLayout;
  scheme: Scheme;
  running: number;
  pending: number;
  dragHandlers?: (item: Item) => MascotDragHandlers;
}

function placementStyle({ x, y, size }: MascotPlacement): CSSProperties {
  return { '--item-x': x / 100, '--item-y': y / 100, '--item-scale': size / 100 } as CSSProperties;
}

export function MascotScene({ avatar, layout, scheme, running, pending, dragHandlers }: Props) {
  const numbers = new Intl.NumberFormat(currentLanguage());
  return (
    <div
      className={styles.scene}
      data-mascot-state={running ? 'working' : 'idle'}
      data-scheme={scheme}
      data-preview={dragHandlers ? '' : undefined}
    >
      <div
        className={styles.mascot}
        style={placementStyle(layout.mascot)}
        aria-hidden="true"
        {...dragHandlers?.('mascot')}
      >
        <span className={styles.float}>
          {isImageAvatar(avatar) ? <img src={avatar} alt="" draggable={false} /> : <span>{avatar}</span>}
        </span>
      </div>
      <div className={styles.cardSlot} style={placementStyle(layout.card)} {...dragHandlers?.('card')}>
        <section className={styles.card} aria-label={t('mascotChannel')} aria-hidden={dragHandlers ? undefined : true}>
          <div className={styles.heading}>
            <span className={styles.lamp} aria-hidden="true" />
            <strong>{t('mascotChannel')}</strong>
          </div>
          <dl className={styles.counts}>
            <div>
              <dt>{t('mascotRunning')}</dt>
              <dd>{numbers.format(running)}</dd>
            </div>
            <div>
              <dt>{t('mascotPending')}</dt>
              <dd>{numbers.format(pending)}</dd>
            </div>
          </dl>
        </section>
      </div>
    </div>
  );
}
