import { useEffect, useState } from 'react';
import { Button, Icon, IconButton, notifyInfo, reportError } from '@/shared/ui';
import type { BuiltinSkill, LibraryAddMode, Skill } from '@/shared/types/domain';
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
    <section className={styles.picker} aria-label="内蔵スキルから追加">
      <div className={styles.head}>
        <h4 className={styles.title}>内蔵スキルから追加</h4>
        <IconButton label="内蔵スキルから追加を閉じる" onClick={onClose}>
          <Icon name="close" />
        </IconButton>
      </div>
      <p className={styles.help}>
        アプリに入っている手引きです。「追加」は内蔵スキルを参照し、アプリを更新すると内容も新しくなります（アプリでは編集できません）。「コピーして追加」は本文を取り込み、アプリで編集できます。
      </p>
      {builtins === null ? (
        <p className={styles.help}>読み込み中…</p>
      ) : (
        <ul className={styles.entries} aria-label="内蔵スキル">
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
      .then(
        () => notifyInfo(mode === 'link' ? `${entry.name} を追加しました` : `${entry.name} をコピーして追加しました`),
        reportError,
      )
      .finally(() => setBusy(false));
  };
  const taken = state.kind === 'nameTaken';
  return (
    <li className={styles.entry} data-disabled={state.kind === 'available' ? undefined : ''}>
      <div className={styles.entryText}>
        <span className={styles.entryHead}>
          <code className={styles.entryName}>{entry.name}</code>
        </span>
        <span className={styles.description}>{entry.description}</span>
        {taken && (
          <span className={styles.warning}>
            <Icon name="alert" className={styles.warningIcon} />
            同じ名前のスキル「{entry.name}」がすでにあります。
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
            <Button size="sm" variant="primary" onClick={() => add('link')} disabled={busy || taken}>
              追加
            </Button>
            <Button size="sm" variant="ghost" onClick={() => add('copy')} disabled={busy || taken}>
              コピーして追加
            </Button>
          </>
        )}
      </div>
    </li>
  );
}
