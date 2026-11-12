import { useEffect } from 'react';
import { openSettings } from '@/features/settings';
import { checkForUpdate, updateNotice, versionToNotify } from '@/features/update';
import { notifyInfo } from '@/shared/ui';
import { t } from './i18n';

/** 開いたままのアプリでも新しい版に気づけるよう、確かめ直す間隔 */
const RECHECK_MS = 6 * 60 * 60 * 1000;

/**
 * 起動時と、その後は一定の間隔で新しい版を確かめ、あれば知らせる（同じ版は1回だけ）。
 * 確かめられなくても何も出さない（オフラインでも静かに動く。設定の［更新を確認］では理由が見える）。
 */
export function useUpdateNotice(): void {
  useEffect(() => {
    let notified: string | null = null;
    const check = () => {
      void checkForUpdate().then((status) => {
        const latest = versionToNotify(status, notified);
        if (latest === null) return;
        notified = latest.version;
        notifyInfo(updateNotice(latest), { label: t('viewUpdate'), run: () => openSettings('update') });
      });
    };
    check();
    const timer = setInterval(check, RECHECK_MS);
    return () => clearInterval(timer);
  }, []);
}
