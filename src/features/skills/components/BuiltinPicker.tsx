import { useEffect, useState } from 'react';
import { Button, Icon, IconButton, notifyInfo, reportError } from '@/shared/ui';
import type { BuiltinSkill, LibraryAddMode, Skill } from '@/shared/types/domain';
import { tLibrary as t } from '../i18n/library';
import { builtinEntryState } from '../model/library';
import { addBuiltinSkill, listBuiltinSkills } from '../store';
import styles from './LibraryPicker.module.css';

export interface BuiltinPickerProps {
  agentId: string;
  /** そのエージェントのスキル（追加済み・同じ名前を見分ける） */
  existing: readonly Skill[];
  onClose: () => void;
}

/** 内蔵スキルから追加: アプリに同梱したスキルの一覧・追加（link）とコピーして追加（copy） */
export function BuiltinPicker({ agentId, existing, onClose }: BuiltinPickerProps) {
  const [builtins, setBuiltins] = useState<BuiltinSkill[] | null>(null);

  useEffect(() => {
    let alive = true;
    listBuiltinSkills()
      .then((found) => alive && setBuiltins(found))
      .catch(reportError);
    return () => {
      alive = false;
    };
  }, []);

  return (
    <section className={styles.picker} aria-label={t('builtinTitle')}>
      <div className={styles.head}>
        <h4 className={styles.title}>{t('builtinTitle')}</h4>
        <IconButton label={t('closeBuiltin')} onClick={onClose}>
          <Icon name="close" />
        </IconButton>
      </div>
      <p className={styles.help}>{t('builtinHelp')}</p>
      {builtins === null ? (
        <p className={styles.help}>{t('loading')}</p>
      ) : (
        <ul className={styles.entries} aria-label={t('builtinList')}>
          {builtins.map((entry) => (
            <BuiltinEntry key={entry.name} agentId={agentId} entry={entry} existing={existing} />
          ))}
        </ul>
      )}
    </section>
  );
}

interface BuiltinEntryProps {
  agentId: string;
  entry: BuiltinSkill;
  existing: readonly Skill[];
}

/** 内蔵スキル1つ。追加済みは印だけ、同じ名前のスキルがあれば理由を出して押せなくする */
function BuiltinEntry({ agentId, entry, existing }: BuiltinEntryProps) {
  const [busy, setBusy] = useState(false);
  const state = builtinEntryState(entry, existing);
  const add = (mode: LibraryAddMode) => {
    setBusy(true);
    void addBuiltinSkill(agentId, entry.name, mode)
      .then(() => notifyInfo(t(mode === 'link' ? 'added' : 'copiedAdded', { name: entry.name })), reportError)
      .finally(() => setBusy(false));
  };
  const taken = state.kind === 'nameTaken';
  return (
    <li className={styles.entry} data-disabled={state.kind === 'available' ? undefined : ''}>
      <div className={styles.entryText}>
        <span className={styles.entryHead}>
          <code className={styles.entryName}>{entry.name}</code>
          <span className={styles.meta} title={entry.files.join('\n')}>
            {entry.files.length > 0 ? t('extraFiles', { count: entry.files.length }) : t('noExtraFiles')}
          </span>
        </span>
        <span className={styles.description}>{entry.description}</span>
        {taken && (
          <span className={styles.warning}>
            <Icon name="alert" className={styles.warningIcon} />
            {t('nameTaken', { name: entry.name })}
          </span>
        )}
      </div>
      <div className={styles.entryActions}>
        {state.kind === 'added' ? (
          <span className={styles.added}>
            <Icon name="check" />
            {t('addedMark')}
          </span>
        ) : (
          <>
            <Button size="sm" variant="primary" onClick={() => add('link')} disabled={busy || taken}>
              {t('add')}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => add('copy')}
              disabled={busy || taken}
              title={entry.files.length > 0 ? t('copyTitleWithFiles', { count: entry.files.length }) : t('copyTitle')}
            >
              {t('copyAdd')}
            </Button>
          </>
        )}
      </div>
    </li>
  );
}
