// 初回起動の初期設定（名前・スキルのフォルダ・データの保存先）の保存のしかた（docs/ui-design.md §5.11）。
// スキルのフォルダは選んだ時点で保存する（設定ダイアログと同じ部品）。名前と保存先は「はじめる」で保存する。
import type { DataDirMode } from '@/shared/types/domain';

/** 「はじめる」で保存するもの */
export interface SetupPlan {
  /** 変えた名前（変えていない・保存しないなら null） */
  name: string | null;
  /** 選んだ新しい保存先（変えていなければ null） */
  dataDir: { path: string; mode: DataDirMode } | null;
}

export interface SetupSteps {
  saveName: (name: string) => Promise<unknown>;
  complete: () => Promise<unknown>;
  /** 成功するとアプリが再起動する */
  changeDataDir: (path: string, mode: DataDirMode) => Promise<unknown>;
}

/** 入力から保存するものを決める。その場所のデータを開く（open）なら、名前はそのデータのものになるので保存しない */
export function setupPlan(name: string, currentName: string, dataDir: string | null, mode: DataDirMode): SetupPlan {
  const trimmed = name.trim();
  const opening = dataDir !== null && mode === 'open';
  return {
    name: trimmed === currentName || opening ? null : trimmed,
    dataDir: dataDir === null ? null : { path: dataDir, mode },
  };
}

/**
 * 名前 → 初期設定を終えた印 → 保存先の変更 の順に保存する。保存先の変更を最後にするのは、成功するとアプリが再起動し、
 * copy なら保存した名前も新しい場所へ写るから。途中で失敗したら、そこで止まる（やり直せば同じ順で進む）
 */
export async function runSetup(plan: SetupPlan, steps: SetupSteps): Promise<void> {
  if (plan.name !== null) await steps.saveName(plan.name);
  await steps.complete();
  if (plan.dataDir !== null) await steps.changeDataDir(plan.dataDir.path, plan.dataDir.mode);
}
