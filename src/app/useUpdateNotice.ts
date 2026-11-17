import { useEffect, useRef } from 'react';
import { openSettings } from '@/features/settings';
import { checkForUpdate, updateNotice, useAutoCheckEnabled, versionToNotify } from '@/features/update';
import { notifyInfo } from '@/shared/ui';
import { t } from './i18n';

/** 開いたままのアプリでも新しい版に気づけるよう、確かめ直す間隔 */
const RECHECK_MS = 5 * 60 * 1000;

/**
 * 起動時・復帰時・通信復旧時と5分ごとに新しい版を確かめ、あれば知らせる（同じ版は1回だけ）。
 * 確かめられなくても何も出さない（オフラインでも静かに動く。設定の［更新を確認］では理由が見える）。
 * 設定で自動の確認をオフにしていれば、何も確かめない（オンに戻したらすぐ確かめる）。
 */
export function useUpdateNotice(): void {
  const enabled = useAutoCheckEnabled();
  const notified = useRef<string | null>(null);
  useEffect(() => {
    if (!enabled) return;
    const check = () => {
      void checkForUpdate().then((status) => {
        const latest = versionToNotify(status, notified.current);
        if (latest === null) return;
        notified.current = latest.version;
        notifyInfo(updateNotice(latest), { label: t('viewUpdate'), run: () => openSettings('update') });
      });
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') check();
    };
    check();
    const timer = setInterval(check, RECHECK_MS);
    window.addEventListener('focus', check);
    window.addEventListener('online', check);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', check);
      window.removeEventListener('online', check);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [enabled]);
}
