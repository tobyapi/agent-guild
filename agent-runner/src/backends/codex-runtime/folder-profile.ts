// 指定フォルダのチャンネルでの Codex の権限プロファイル（Windows の MXC）。
// Codex はファイルの読み書きもシェルで行うので、道具ごとには止められない。そのかわり、シェルとその子プロセスを
// OS の隔離の中に入れ、読める場所・書ける場所・通信を権限プロファイルで決める:
//   書ける: チャンネル専用の作業場所と、割り当てフォルダ
//   読める: それに加えて、相談相手の成果物・添付・道具のフォルダ（PATH）・Windows の部品（:minimal）
//   読めない: 相談相手の MEMORY.md、ほかのすべて（利用者のホームも）。一時フォルダにも書けない
// 設定は、利用者の ~/.codex/config.toml を書き換えずに、起動時の上書き（--config）で渡す。sandbox_mode とは併用できない。
// この PC で確かめたことは docs/codex-folder-scope.md。

import { realpath } from 'node:fs/promises';
import { join } from 'node:path';
import { prepareCommandSandbox } from '../command-sandbox.ts';
import { toolDirs } from '../command-sandbox/policy.ts';
import { BackendError, type RunRequest } from '../types.ts';

/** 権限プロファイルの名前（Codex の設定の permissions.<名前>） */
export const FOLDER_PROFILE = 'guild_folder';

export interface FolderProfileScope {
  /** 読み書きできる場所（リンクを解決済み） */
  writable: readonly string[];
  /** 読み取りだけできる場所 */
  readable: readonly string[];
  /** 読める場所の中で、読ませないもの */
  denied: readonly string[];
  /** コマンドの通信を許すか（Web 閲覧の権限があるときだけ） */
  network: boolean;
}

/** TOML の文字列（基本文字列）。JSON の文字列と同じ書き方で表せる */
const toml = (value: string): string => JSON.stringify(value);

/** Codex の起動時の上書き（`キー=TOML の値` の並び）。パスはキーに入るので、表ごとインラインで渡す */
export function profileOverrides(scope: FolderProfileScope): string[] {
  const entries: [string, string][] = [
    [':minimal', 'read'],
    ...scope.readable.map((path): [string, string] => [path, 'read']),
    ...scope.writable.map((path): [string, string] => [path, 'write']),
    ...scope.denied.map((path): [string, string] => [path, 'none']),
  ];
  const table = entries.map(([path, access]) => `${toml(path)} = ${toml(access)}`).join(', ');
  return [
    'windows.sandbox="mxc"',
    `default_permissions=${toml(FOLDER_PROFILE)}`,
    `permissions.${FOLDER_PROFILE}.filesystem={${table}}`,
    `permissions.${FOLDER_PROFILE}.network={enabled = ${scope.network}}`,
  ];
}

/** 実在するものだけ、リンクを解決して返す */
async function existing(paths: readonly string[]): Promise<string[]> {
  const resolved = await Promise.all(paths.map((path) => realpath(path).catch(() => null)));
  return [...new Set(resolved.filter((path): path is string => path !== null))];
}

/**
 * 指定フォルダの依頼の範囲。相談相手（読み取りだけの場所）の MEMORY.md は、まだなくても拒否に入れる
 * （実行中に作られても読ませない）
 */
export async function folderProfileScope(request: RunRequest, env: NodeJS.ProcessEnv): Promise<FolderProfileScope> {
  const writable = await existing([request.workspace, ...(request.writableDirs ?? [])]);
  const peers = (await existing(request.readableDirs)).filter((dir) => !writable.includes(dir));
  return {
    writable,
    readable: [...peers, ...toolDirs(env, [...writable, ...peers])],
    denied: peers.map((dir) => join(dir, 'MEMORY.md')),
    network: request.permissions.webFetch,
  };
}

/**
 * 指定フォルダの依頼なら、Codex に渡す上書き。そうでなければ空。OS の隔離を使えない PC では実行しない
 * （Codex の MXC は Windows 11 だけ。macOS・Linux の権限プロファイルは確かめていない）
 */
export async function folderOverrides(request: RunRequest, env: NodeJS.ProcessEnv = process.env): Promise<string[]> {
  if (request.writableDirs === undefined) return [];
  if (process.platform !== 'win32' || !(await prepareCommandSandbox())) {
    throw new BackendError(
      'unsupported_permission',
      'フォルダ制限には OS の隔離が必要です（このバックエンドでは、隔離が使える Windows 11 で使えます）',
    );
  }
  return profileOverrides(await folderProfileScope(request, env));
}
