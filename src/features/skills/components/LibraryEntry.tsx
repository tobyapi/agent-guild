import { useState } from 'react';
import { folderName } from '@/shared/lib/paths';
import { Button, Icon, notifyInfo, reportError } from '@/shared/ui';
import type { LibraryAddMode, LibrarySkill, Skill } from '@/shared/types/domain';
import { tLibrary as t } from '../i18n/library';
import { libraryEntryState } from '../model/library';
import { addLibrarySkill } from '../store';
import styles from './LibraryPicker.module.css';

export interface LibraryEntryProps {
  agentId: string;
  entry: LibrarySkill;
  existing: readonly Skill[];
}

/** ライブラリのスキル1つ。追加済みは印だけ、問題があるもの・同じ名前があるものは理由を出して押せなくする */
export function LibraryEntry({ agentId, entry, existing }: LibraryEntryProps) {
  const [busy, setBusy] = useState(false);
  const state = libraryEntryState(entry, existing);
  const add = (mode: LibraryAddMode) => {
    setBusy(true);
    void addLibrarySkill(agentId, entry.path, mode)
      .then(() => notifyInfo(t(mode === 'link' ? 'added' : 'copiedAdded', { name: entry.name })), reportError)
      .finally(() => setBusy(false));
  };
  const reason =
    state.kind === 'problem' ? state.reason : state.kind === 'nameTaken' ? t('nameTaken', { name: entry.name }) : null;
  const extras = entry.fileCount > 0 ? t('extraFiles', { count: entry.fileCount }) : t('noExtraFiles');
  return (
    <li className={styles.entry} data-disabled={state.kind === 'available' ? undefined : ''}>
      <div className={styles.entryText}>
        <span className={styles.entryHead}>
          <code className={styles.entryName}>{entry.name}</code>
          <span className={styles.meta} title={entry.path}>
            {folderName(entry.libraryDir)} · {extras}
          </span>
        </span>
        <span className={styles.description}>{entry.description || t('noDescription')}</span>
        {reason && (
          <span className={styles.warning}>
            <Icon name="alert" className={styles.warningIcon} />
            {reason}
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
            <Button size="sm" variant="primary" onClick={() => add('link')} disabled={busy || reason !== null}>
              {t('add')}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => add('copy')}
              disabled={busy || reason !== null}
              title={entry.fileCount > 0 ? t('copyTitleWithFiles', { count: entry.fileCount }) : t('copyTitle')}
            >
              {t('copyAdd')}
            </Button>
          </>
        )}
      </div>
    </li>
  );
}
