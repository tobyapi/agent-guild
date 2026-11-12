import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Button, Icon, Lamp, reportError } from '@/shared/ui';
import { useRuntimeStatus } from '../hooks/useRuntime';
import { t } from '../i18n';
import { runtimeBanner } from '../model/status';
import type { RuntimeBannerModel } from '../model/status';
import { restartApp } from '../store';
import styles from './RuntimeBanner.module.css';

/** 起動直後の一瞬の starting では帯を出さない（毎回のちらつきを防ぐ） */
const STARTING_GRACE_MS = 1500;

/** ランナーの状態の帯（窓の最上部、3 列の上に全幅で出す。ready なら何も出さない） */
export function RuntimeBanner() {
  const banner = runtimeBanner(useRuntimeStatus());
  if (!banner) return null;
  if (banner.state === 'starting') {
    return (
      <AfterDelay ms={STARTING_GRACE_MS}>
        <BannerView banner={banner} />
      </AfterDelay>
    );
  }
  return <BannerView banner={banner} />;
}

function BannerView({ banner }: { banner: RuntimeBannerModel }) {
  const unavailable = banner.state === 'unavailable';
  return (
    <div className={styles.banner} data-state={banner.state} role={unavailable ? 'alert' : 'status'}>
      {unavailable ? <Icon name="alert" className={styles.icon} /> : <Lamp waiting />}
      <p className={styles.text} title={banner.detail || undefined}>
        <b className={styles.title}>{banner.title}</b>
        {banner.detail && ` — ${banner.detail}`}
      </p>
      {unavailable && (
        <Button size="sm" onClick={() => void restartApp().catch(reportError)}>
          {t('restart')}
        </Button>
      )}
    </div>
  );
}

/** ms だけ待ってから children を出す（外されたら最初からやり直し） */
function AfterDelay({ ms, children }: { ms: number; children: ReactNode }) {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setShown(true), ms);
    return () => clearTimeout(timer);
  }, [ms]);
  return shown ? children : null;
}
