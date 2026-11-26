import { useId, useState } from 'react';
import { AvatarPresetPicker } from '@/features/agents';
import { useBackends } from '@/features/runtime';
import { Button, SwitchField } from '@/shared/ui';
import type { Scheme } from '@/shared/theme/types';
import { setMascotEnabled, setMascotSource, useAppearanceStore } from '../appearance';
import { tAppearance as t } from '../i18n/appearance';
import { canGenerateBackground } from '../useBackgroundGeneration';
import { GenerateBackgroundDialog } from './GenerateBackgroundDialog';
import { MascotChoicesDialog } from './MascotChoicesDialog';
import { MascotLayoutEditor } from './MascotLayoutEditor';
import styles from './MascotControls.module.css';

export function MascotControls({ scheme }: { scheme: Scheme }) {
  const enabled = useAppearanceStore((state) => state.mascot.enabled);
  const reason = useId();
  const [dialog, setDialog] = useState<'select' | 'generate' | null>(null);
  const [cancelled, setCancelled] = useState(false);
  const canGenerate = useBackends().some(canGenerateBackground);
  return (
    <div className={styles.group}>
      <SwitchField label={t('mascotShow')} checked={enabled} onChange={setMascotEnabled} />
      <div className={styles.actions}>
        <Button size="sm" aria-haspopup="dialog" onClick={() => setDialog('select')}>
          {t('mascotChoose')}
        </Button>
        {enabled && (
          <>
            <AvatarPresetPicker
              fullBody
              onChoose={(avatar) => setMascotSource({ kind: 'preset', avatar, fullBody: true })}
            />
            <Button
              size="sm"
              aria-haspopup="dialog"
              disabled={!canGenerate}
              aria-describedby={canGenerate ? undefined : reason}
              onClick={() => {
                setCancelled(false);
                setDialog('generate');
              }}
            >
              {t('mascotGenerateTitle')}
            </Button>
          </>
        )}
      </div>
      {enabled && !canGenerate && (
        <p id={reason} className={styles.note}>
          {t('mascotNoReady')}
        </p>
      )}
      {cancelled && <p role="status">{t('mascotCancelled')}</p>}
      {enabled && <MascotLayoutEditor scheme={scheme} />}
      {dialog === 'select' && <MascotChoicesDialog onClose={() => setDialog(null)} />}
      {dialog === 'generate' && (
        <GenerateBackgroundDialog
          kind="mascot"
          onClose={(wasCancelled) => {
            setCancelled(wasCancelled);
            setDialog(null);
          }}
          onGenerated={(id) => {
            setMascotSource({ kind: 'generated', id });
            setDialog(null);
          }}
        />
      )}
    </div>
  );
}
