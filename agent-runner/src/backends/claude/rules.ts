// Claude で単独では守れない操作の規則と、コマンドの渡し方。
// Claude 内蔵の Bash は OS の隔離に入れられないので、Bash をそのまま渡すのは、読み書き（作業場所の外も）と Web を
// すべて許す役割（作業者）だけ。それ以外の役割のコマンドは、共通の隔離（command-sandbox.ts）が使える PC でだけ、
// 隔離の中で動くアプリ側の道具（command.ts）として渡す。隔離が使えなければコマンドは使わない。

import { commandSandboxReady } from '../command-sandbox.ts';
import type { PermissionKey, PermissionRule, Permissions } from '../../protocol.ts';
import { brokenRule, declaredRules, type ExplainedRule } from '../types.ts';

/** Bash をそのまま渡すのに要る権限（Bash はファイルとネットワークを自由に使える） */
const BASH_REQUIRES: readonly PermissionKey[] = ['readFiles', 'writeFiles', 'writeAnywhere', 'webFetch', 'webSearch'];

const WRITE_RULE: ExplainedRule = {
  when: 'writeAnywhere',
  requires: ['writeFiles'],
  reason: '作業場所の外への書き込みを許すなら、ファイルの書き込みも許してください',
};
const BASH_RULE: ExplainedRule = {
  when: 'runCommands',
  requires: [...BASH_REQUIRES],
  reason: 'コマンドの実行を許すと、作業場所の外も含めたファイルの読み書きやネットワークアクセスを止められません',
};

/** 隔離の中でコマンドを動かせる（sandboxed）なら、コマンドは単独でも守れる */
const rules = (sandboxed: boolean): readonly ExplainedRule[] => (sandboxed ? [WRITE_RULE] : [WRITE_RULE, BASH_RULE]);

/** 申告する権限の規則（BackendInfo.permissionRules）。隔離が使える PC では、コマンドの規則がなくなる */
export function permissionRules(sandboxed: boolean = commandSandboxReady()): PermissionRule[] {
  return declaredRules(rules(sandboxed));
}

/** Claude で守れない権限の組み合わせなら、その理由 */
export function unenforceableReason(
  permissions: Permissions,
  sandboxed: boolean = commandSandboxReady(),
): string | null {
  return brokenRule(rules(sandboxed), permissions)?.reason ?? null;
}

/** コマンドの渡し方: bash は内蔵の Bash（隔離なし）、sandbox は隔離の中で動くアプリ側の道具、none は渡さない */
export type CommandMode = 'bash' | 'sandbox' | 'none';

export function commandMode(permissions: Permissions, sandboxed: boolean = commandSandboxReady()): CommandMode {
  if (!permissions.runCommands) return 'none';
  if (BASH_REQUIRES.every((key) => permissions[key])) return 'bash';
  return sandboxed ? 'sandbox' : 'none';
}

/**
 * 持ち出しの危険がある組（BackendInfo.leakRisks）。作業場所の外にも書けるなら読み取りもどこでもでき（fileAccessPolicy）、
 * Web 閲覧は URL に情報を入れて外へ送れる。内蔵の Bash を渡す役割では、必ずこの組もそろう（BASH_REQUIRES）。
 * 隔離の中のコマンドは通信できないので、この組には入らない
 */
export const LEAK_RISKS: readonly (readonly PermissionKey[])[] = [
  ['readFiles', 'writeAnywhere', 'webFetch'],
  ['readFiles', 'readAnywhere', 'webFetch'],
];
