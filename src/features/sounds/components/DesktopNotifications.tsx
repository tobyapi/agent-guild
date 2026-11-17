import { useEffect, useState } from 'react';
import { SwitchField, reportError } from '@/shared/ui';
import { getDesktopNotifications, setDesktopNotifications } from '../api';
import { t } from '../i18n';

export function DesktopNotifications() {
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(true);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    let active = true;
    getDesktopNotifications()
      .then((value) => {
        if (active) {
          setEnabled(value);
          setLoaded(true);
        }
      })
      .catch(reportError)
      .finally(() => {
        if (active) setBusy(false);
      });
    return () => {
      active = false;
    };
  }, []);
  const change = async (value: boolean) => {
    setBusy(true);
    try {
      await setDesktopNotifications(value);
      setEnabled(value);
    } catch (error) {
      reportError(error);
    } finally {
      setBusy(false);
    }
  };
  return (
    <SwitchField
      label={t('desktopNotifications')}
      hint={t('desktopNotificationsHint')}
      checked={enabled}
      disabled={busy || !loaded}
      onChange={(value) => void change(value)}
    />
  );
}
