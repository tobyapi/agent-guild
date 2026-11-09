import { useEffect, useState } from 'react';
import { useActiveAgents } from '@/features/agents';
import { saveProfile, useProfile } from '@/features/profile';
import { errorCode, errorField, errorMessage } from '@/shared/lib/errors';
import { checkMemberName } from '@/shared/lib/names';
import { isSamePath } from '@/shared/lib/paths';
import { notifyInfo, reportError } from '@/shared/ui';
import type { DataDirMode } from '@/shared/types/domain';
import { runSetup, setupPlan } from '../model/setup';
import { changeDataDir, chooseFolder, closeSetup, completeSetup, loadStorageInfo, useSettingsStore } from '../store';

/** 失敗をどこに出すか: 名前の問題は名前の欄、保存先の問題はダイアログの帯、それ以外（null）はトースト */
type SetupFailure = { field: 'name'; message: string } | { field: 'dataDir'; message: string; conflict: boolean } | null;

function failureOf(reason: unknown): SetupFailure {
  const code = errorCode(reason);
  if (code === 'validation' && errorField(reason) === 'name') return { field: 'name', message: errorMessage(reason) };
  if (code === 'conflict' || code === 'validation') {
    return { field: 'dataDir', message: errorMessage(reason), conflict: code === 'conflict' };
  }
  return null;
}

/**
 * 初回起動の初期設定の入力と「はじめる」。保存先を変えたら、成功するとアプリが再起動する（それまで busy のまま）。
 * 選んだフォルダにギルドのデータがあれば（copy が conflict）、その場所のデータを開く（open）に切り替えて知らせる
 */
export function useSetup() {
  const me = useProfile();
  const agents = useActiveAgents();
  const storage = useSettingsStore((state) => state.storage);
  const [name, setName] = useState(me.name);
  const [nameError, setNameError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  const [dataDir, setDataDir] = useState<string | null>(null);
  const [mode, setMode] = useState<DataDirMode>('copy');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadStorageInfo().catch(reportError);
  }, []);

  const nameProblem = checkMemberName(name, agents.map((agent) => agent.name));
  const pickDataDir = (path: string | null) => {
    setDataDir(path !== null && storage && isSamePath(path, storage.dataDir) ? null : path);
    setMode('copy');
    setError(null);
  };
  const chooseDataDir = () => {
    chooseFolder().then((path) => {
      if (path !== null) pickDataDir(path);
    }, reportError);
  };

  const fail = (reason: unknown) => {
    const failure = failureOf(reason);
    if (failure === null) reportError(reason);
    else if (failure.field === 'name') setNameError(failure.message);
    else if (failure.conflict) {
      // 設定ダイアログ向けの文面（「その場所のデータを開く」を選ぶ）ではなく、この画面の言い方で知らせる
      setMode('open');
      setError('このフォルダにはギルドのデータがあります。そのデータではじめるか、別のフォルダを選んでください。');
    } else setError(failure.message);
    setBusy(false);
  };

  const submit = async () => {
    setTouched(true);
    if (nameProblem !== null) return;
    setBusy(true);
    setError(null);
    try {
      const steps = { saveName: (value: string) => saveProfile({ ...me, name: value }), complete: completeSetup, changeDataDir };
      await runSetup(setupPlan(name, me.name, dataDir, mode), steps);
      if (dataDir === null) closeSetup();
      else notifyInfo('保存先を変えました。アプリを再起動します…');
    } catch (reason) {
      fail(reason);
    }
  };

  const updateName = (value: string) => {
    setName(value);
    setNameError(null);
  };
  return {
    name,
    updateName,
    touchName: () => setTouched(true),
    nameError: nameError ?? (touched ? nameProblem : null) ?? undefined,
    storage,
    dataDir,
    mode,
    busy,
    error,
    chooseDataDir,
    resetDataDir: () => pickDataDir(null),
    submit,
  };
}
