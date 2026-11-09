import { useEffect, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Button, Icon, IconButton, notifyError, reportError } from '@/shared/ui';
import { chooseLibraryFolder, loadSkillLibrary, setLibraryDirs, useLibraryStore } from '../libraryStore';
import { checkNewDir, moveItem, skillCountIn } from '../model/library';
import { revealSkillFolder } from '../store';
import styles from './SkillLibrarySection.module.css';

/** 設定の「スキルのフォルダ」: 指定済みのフォルダ（見つかった数・問題）・追加・外す・並べ替え・再読み込み */
export function SkillLibrarySection() {
  const { library, loading } = useLibraryStore(
    useShallow((state) => ({ library: state.library, loading: state.loading })),
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSkillLibrary().catch(reportError);
  }, []);

  if (!library) return <p className={styles.help}>読み込み中…</p>;
  const { dirs } = library;
  const save = (next: string[]) => {
    setSaving(true);
    void setLibraryDirs(next)
      .catch(reportError)
      .finally(() => setSaving(false));
  };
  const add = () => {
    chooseLibraryFolder().then((path) => {
      if (path === null) return;
      const problem = checkNewDir(dirs, path);
      if (problem) notifyError(problem);
      else save([...dirs, path]);
    }, reportError);
  };

  return (
    <>
      <p className={styles.help}>
        Agent Skills のフォルダ（<code>名前/SKILL.md</code>{' '}
        が入ったフォルダ）を指定すると、エージェントのスキルに「ライブラリから追加」ですぐ付けられます。フォルダの中身を変えたら「再読み込み」を押してください。
      </p>
      {dirs.length === 0 ? (
        <p className={styles.empty}>まだフォルダを指定していません。</p>
      ) : (
        <ol className={styles.dirs} aria-label="スキルのフォルダ（上から順に並びます）">
          {dirs.map((dir, index) => (
            <DirRow
              key={dir}
              dir={dir}
              count={skillCountIn(library, dir)}
              problem={library.dirProblems[dir] ?? null}
              first={index === 0}
              last={index === dirs.length - 1}
              busy={saving}
              onMove={(delta) => save(moveItem(dirs, index, delta))}
              onRemove={() => save(dirs.filter((_, position) => position !== index))}
            />
          ))}
        </ol>
      )}
      <div className={styles.actions}>
        <Button onClick={add} disabled={saving}>
          <Icon name="plus" />
          フォルダを追加…
        </Button>
        <Button variant="ghost" onClick={() => void loadSkillLibrary().catch(reportError)} disabled={loading}>
          <Icon name="refresh" />
          {loading ? '読み込み中…' : '再読み込み'}
        </Button>
      </div>
    </>
  );
}

interface DirRowProps {
  dir: string;
  count: number;
  problem: string | null;
  first: boolean;
  last: boolean;
  busy: boolean;
  onMove: (delta: -1 | 1) => void;
  onRemove: () => void;
}

function DirRow({ dir, count, problem, first, last, busy, onMove, onRemove }: DirRowProps) {
  return (
    <li className={styles.dir}>
      <div className={styles.dirText}>
        <code className={styles.path} title={dir}>
          {dir}
        </code>
        {problem ? (
          <span className={styles.problem}>
            <Icon name="alert" className={styles.problemIcon} />
            {problem}
          </span>
        ) : (
          <span className={styles.count}>スキル {count} 個</span>
        )}
      </div>
      <div className={styles.dirActions}>
        <IconButton label={`${dir} を上へ`} onClick={() => onMove(-1)} disabled={busy || first}>
          <Icon name="arrowUp" />
        </IconButton>
        <IconButton label={`${dir} を下へ`} onClick={() => onMove(1)} disabled={busy || last}>
          <Icon name="arrowDown" />
        </IconButton>
        <IconButton
          label={`${dir} を開く`}
          onClick={() => void revealSkillFolder(dir).catch(reportError)}
          disabled={problem !== null}
        >
          <Icon name="folder" />
        </IconButton>
        <IconButton label={`${dir} を外す`} onClick={onRemove} disabled={busy}>
          <Icon name="close" />
        </IconButton>
      </div>
    </li>
  );
}
