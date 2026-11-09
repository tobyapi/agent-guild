import { useState } from 'react';
import { folderName } from '@/shared/lib/paths';
import { Button, Icon, notifyInfo, reportError } from '@/shared/ui';
import type { LibraryAddMode, LibrarySkill, Skill } from '@/shared/types/domain';
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
      .then(() => notifyInfo(mode === 'link' ? `${entry.name} を追加しました` : `${entry.name} をコピーして追加しました`), reportError)
      .finally(() => setBusy(false));
  };
  const reason = state.kind === 'problem' ? state.reason : state.kind === 'nameTaken' ? `同じ名前のスキル「${entry.name}」がすでにあります。` : null;
  const extras = entry.fileCount > 0 ? `付属ファイル ${entry.fileCount} 個` : '付属ファイルなし';
  return (
    <li className={styles.entry} data-disabled={state.kind === 'available' ? undefined : ''}>
      <div className={styles.entryText}>
        <span className={styles.entryHead}>
          <code className={styles.entryName}>{entry.name}</code>
          <span className={styles.meta} title={entry.path}>
            {folderName(entry.libraryDir)} · {extras}
          </span>
        </span>
        <span className={styles.description}>{entry.description || '（説明がありません）'}</span>
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
            追加済み
          </span>
        ) : (
          <>
            <Button size="sm" variant="primary" onClick={() => add('link')} disabled={busy || reason !== null}>
              追加
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => add('copy')}
              disabled={busy || reason !== null}
              title={entry.fileCount > 0 ? `SKILL.md の本文だけを取り込みます（付属ファイル ${entry.fileCount} 個は持ち込みません）` : 'SKILL.md の本文を取り込みます'}
            >
              コピーして追加
            </Button>
          </>
        )}
      </div>
    </li>
  );
}
