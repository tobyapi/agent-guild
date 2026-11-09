import { useEffect, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Button, Icon, IconButton, reportError, TextField } from '@/shared/ui';
import type { Skill, SkillLibrary } from '@/shared/types/domain';
import { loadSkillLibrary, useLibraryStore } from '../libraryStore';
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
    <section className={styles.picker} aria-label="ライブラリから追加">
      <div className={styles.head}>
        <h4 className={styles.title}>ライブラリから追加</h4>
        <Button size="sm" variant="ghost" onClick={reload} disabled={loading}>
          <Icon name="refresh" />
          {loading ? '読み込み中…' : '再読み込み'}
        </Button>
        <IconButton label="ライブラリから追加を閉じる" onClick={onClose}>
          <Icon name="close" />
        </IconButton>
      </div>
      {library === null ? (
        <p className={styles.help}>読み込み中…</p>
      ) : library.dirs.length === 0 ? (
        <div className={styles.notice}>
          <b>スキルのフォルダがまだ指定されていません</b>
          設定の「スキルのフォルダ」で、Agent Skills のフォルダ（名前/SKILL.md
          が入ったフォルダ）を指定すると、ここから追加できます。
          <Button size="sm" onClick={onOpenSettings}>
            設定を開く
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
        <b>指定したフォルダにスキルが見つかりません</b>
        {missingDirs > 0
          ? '見つからないフォルダがあります。設定の「スキルのフォルダ」を確かめてください。'
          : 'フォルダに 名前/SKILL.md があるか確かめて、「再読み込み」を押してください。'}
      </div>
    );
  }
  return (
    <>
      <TextField
        label="検索"
        type="search"
        value={query}
        onChange={setQuery}
        placeholder="名前・説明・フォルダで探す"
        autoComplete="off"
      />
      <p className={styles.help}>
        「追加」は元のフォルダを参照し、実行のたびに SKILL.md
        と付属ファイルを読み直します（アプリでは編集できません）。「コピーして追加」は SKILL.md
        の本文だけを取り込み、アプリで編集できます（付属ファイルは持ち込みません）。
      </p>
      {missingDirs > 0 && (
        <p className={styles.warning}>
          <Icon name="alert" className={styles.warningIcon} />
          見つからないフォルダが {missingDirs} 個あります（設定の「スキルのフォルダ」で確かめられます）。
        </p>
      )}
      {found.length === 0 ? (
        <p className={styles.help}>「{query.trim()}」に一致するスキルはありません。</p>
      ) : (
        <ul className={styles.entries} aria-label="ライブラリのスキル">
          {found.map((entry) => (
            <LibraryEntry key={entry.path} agentId={agentId} entry={entry} existing={existing} />
          ))}
        </ul>
      )}
    </>
  );
}
