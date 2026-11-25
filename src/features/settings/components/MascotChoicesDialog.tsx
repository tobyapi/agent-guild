import { useEffect, useState } from 'react';
import { useActiveAgents } from '@/features/agents';
import { Avatar, Button, Dialog, FormAlert } from '@/shared/ui';
import { DEFAULT_MASCOT_AVATAR, type MascotSource } from '@/shared/theme/mascot';
import { settingsApi } from '../api';
import { setMascotSource, useAppearanceStore } from '../appearance';
import { tAppearance as t } from '../i18n/appearance';
import { useMascotImage } from '../useBackgroundImage';
import styles from './MascotControls.module.css';

const PAGE_SIZE = 6;

export function MascotChoicesDialog({ onClose }: { onClose: () => void }) {
  const agents = useActiveAgents();
  const source = useAppearanceStore((state) => state.mascot.source);
  const saveFailed = useAppearanceStore((state) => state.problem === 'save');
  function choose(choice: MascotSource) {
    if (setMascotSource(choice)) onClose();
  }
  return (
    <Dialog
      title={t('mascotChoose')}
      size="md"
      onClose={onClose}
      footer={<Button onClick={onClose}>{t('backgroundCancel')}</Button>}
    >
      <div className={styles.group}>
        {saveFailed && <FormAlert>{t('themeSaveFailed')}</FormAlert>}
        <div className={styles.choices} role="group" aria-label={t('mascotAgents')}>
          <Choice
            label={t('mascotDefault')}
            avatar={DEFAULT_MASCOT_AVATAR}
            selected={source.kind === 'default'}
            choose={() => choose({ kind: 'default' })}
          />
          {agents.map(({ id, name, avatar }) => (
            <Choice
              key={id}
              label={name}
              avatar={avatar}
              selected={source.kind === 'agent' && source.id === id}
              choose={() => choose({ kind: 'agent', id })}
            />
          ))}
        </div>
        <GeneratedChoices
          selected={source.kind === 'generated' ? source.id : null}
          choose={(id) => choose({ kind: 'generated', id })}
        />
      </div>
    </Dialog>
  );
}

function GeneratedChoices({ selected, choose }: { selected: string | null; choose: (id: string) => void }) {
  const [result, setResult] = useState<string[] | 'error' | null>(null);
  const [page, setPage] = useState(0);
  useEffect(() => {
    let active = true;
    void settingsApi.listMascots().then(
      (ids) => {
        if (active) setResult(ids);
      },
      () => {
        if (active) setResult('error');
      },
    );
    return () => {
      active = false;
    };
  }, []);
  if (result === null)
    return (
      <p role="status" className={styles.note}>
        {t('mascotLoading')}
      </p>
    );
  if (result === 'error') return <FormAlert>{t('mascotListFailed')}</FormAlert>;
  if (!result.length) return null;
  const offset = page * PAGE_SIZE;
  const ids = result.slice(offset, offset + PAGE_SIZE);
  return (
    <div className={styles.group}>
      <h3 className={styles.label}>{t('mascotGenerated')}</h3>
      <div className={styles.choices} role="group" aria-label={t('mascotGenerated')}>
        {ids.map((id, index) => (
          <GeneratedChoice
            key={id}
            id={id}
            label={t('mascotGeneratedImage', { number: offset + index + 1 })}
            selected={selected === id}
            choose={() => choose(id)}
          />
        ))}
      </div>
      {result.length > PAGE_SIZE && (
        <div className={styles.actions}>
          <Button size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>
            {t('mascotPrev')}
          </Button>
          <Button size="sm" disabled={offset + PAGE_SIZE >= result.length} onClick={() => setPage(page + 1)}>
            {t('mascotNext')}
          </Button>
        </div>
      )}
    </div>
  );
}

interface ChoiceProps {
  label: string;
  avatar: string;
  selected: boolean;
  choose: () => void;
}

function GeneratedChoice({ id, ...props }: Omit<ChoiceProps, 'avatar'> & { id: string }) {
  const avatar = useMascotImage(id);
  return <Choice {...props} avatar={avatar ?? ''} />;
}

function Choice({ label, avatar, selected, choose }: ChoiceProps) {
  return (
    <Button className={styles.choice} aria-pressed={selected} onClick={choose}>
      <Avatar avatar={avatar} name={label} size="md" />
      <span>{label}</span>
    </Button>
  );
}
