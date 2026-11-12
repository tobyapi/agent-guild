import { useEffect, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Button, Icon, IconButton, reportError, TextField } from '@/shared/ui';
import type { Skill, SkillLibrary } from '@/shared/types/domain';
import { loadSkillLibrary, useLibraryStore } from '../libraryStore';
import { tLibrary as t } from '../i18n/library';
import { searchLibrary } from '../model/library';
import { LibraryEntry } from './LibraryEntry';
import styles from './LibraryPicker.module.css';

export interface LibraryPickerProps {
  agentId: string;
  /** そのエージェントのスキル（追加済み・同じ名前を見分ける） */
  existing: readonly Skill[];
  onClose: () => void;
  /** ライブラリが未設定のとき、設定の「スキルのフォルダ」を開く */
  onOpenSettings: () => void;
}

/** ライブラリから追加: 検索・ライブラリのスキルの一覧・追加（link）とコピーして追加（copy）。開くたびに走査し直す */
export function LibraryPicker({ agentId, existing, onClose, onOpenSettings }: LibraryPickerProps) {
  const { library, loading } = useLibraryStore(
    useShallow((state) => ({ library: state.library, loading: state.loading })),
  );
  const reload = () => void loadSkillLibrary().catch(reportError);

  useEffect(() => {
    loadSkillLibrary().catch(reportError);
  }, []);

  return (
    <section className={styles.picker} aria-label={t('libraryTitle')}>
      <div className={styles.head}>
        <h4 className={styles.title}>{t('libraryTitle')}</h4>
        <Button size="sm" variant="ghost" onClick={reload} disabled={loading}>
          <Icon name="refresh" />
          {loading ? t('loading') : t('reload')}
        </Button>
        <IconButton label={t('closeLibrary')} onClick={onClose}>
          <Icon name="close" />
        </IconButton>
      </div>
      {library === null ? (
        <p className={styles.help}>{t('loading')}</p>
      ) : library.dirs.length === 0 ? (
        <div className={styles.notice}>
          <b>{t('noDirsTitle')}</b>
          {t('noDirsBody')}
          <Button size="sm" onClick={onOpenSettings}>
            {t('openSettings')}
          </Button>
        </div>
      ) : (
        <LibraryList agentId={agentId} existing={existing} library={library} />
      )}
    </section>
  );
}

function LibraryList({
  agentId,
  existing,
  library,
}: {
  agentId: string;
  existing: readonly Skill[];
  library: SkillLibrary;
}) {
  const [query, setQuery] = useState('');
  const found = searchLibrary(library.skills, query);
  const missingDirs = Object.keys(library.dirProblems).length;
  if (library.skills.length === 0) {
    return (
      <div className={styles.notice}>
        <b>{t('noSkillsTitle')}</b>
        {missingDirs > 0 ? t('noSkillsMissingDirs') : t('noSkillsHint')}
      </div>
    );
  }
  return (
    <>
      <TextField
        label={t('search')}
        type="search"
        value={query}
        onChange={setQuery}
        placeholder={t('searchPlaceholder')}
        autoComplete="off"
      />
      <p className={styles.help}>{t('libraryHelp')}</p>
      {missingDirs > 0 && (
        <p className={styles.warning}>
          <Icon name="alert" className={styles.warningIcon} />
          {t('missingDirs', { count: missingDirs })}
        </p>
      )}
      {found.length === 0 ? (
        <p className={styles.help}>{t('noMatch', { query: query.trim() })}</p>
      ) : (
        <ul className={styles.entries} aria-label={t('libraryList')}>
          {found.map((entry) => (
            <LibraryEntry key={entry.path} agentId={agentId} entry={entry} existing={existing} />
          ))}
        </ul>
      )}
    </>
  );
}
