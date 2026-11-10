// エージェントの入力の検証と正規化（docs/design.md §2 入力規則をモック用に）。
import { AUTONOMY_INTERVAL_MIN } from '@/shared/lib/limits';
import { checkEffort, effortFrom, withEffort } from '@/shared/lib/models';
import { checkMemberName } from '@/shared/lib/names';
import { rolePermissions, supportedPermissions } from '@/shared/lib/permissionPolicy';
import { checkTags, cleanTags } from '@/shared/lib/tags';
import type { AgentInput, BackendInfo, OptionSpec } from '@/shared/types/domain';
import { activeAgents, fail } from '../runtime';
import type { MockCore } from '../runtime';

function matchesType(spec: OptionSpec, value: unknown): boolean {
  if (spec.type === 'select') return typeof value === 'string' && spec.choices.includes(value);
  return typeof value === spec.type;
}

/**
 * backendOptions は選んだバックエンドの OptionSpec に合う値だけを残す（未知のキーは捨てる）。
 * 推論の深さはモデルで選べるものだけ（選べなければ validation）
 */
function pickOptions(backend: BackendInfo, input: AgentInput): Record<string, unknown> {
  const effort = effortFrom(input.backendOptions);
  const effortProblem = checkEffort(backend, input.model.trim(), effort);
  if (effortProblem !== null) fail('validation', effortProblem, 'backendOptions');
  const picked = Object.fromEntries(
    Object.entries(input.backendOptions).filter(([key, value]) =>
      backend.options.some((spec) => spec.key === key && matchesType(spec, value)),
    ),
  );
  return withEffort(picked, effort);
}

/** 問題があれば validation で失敗させ、保存してよい形にそろえた入力を返す */
export function validateAgentInput(core: MockCore, input: AgentInput, selfId: string | null): AgentInput {
  const taken = activeAgents(core)
    .filter((agent) => agent.id !== selfId)
    .map((agent) => agent.name);
  const nameProblem = checkMemberName(input.name, [...taken, core.state.me.name]);
  if (nameProblem !== null) fail('validation', nameProblem, 'name');
  const tagProblem = checkTags(input.tags);
  if (tagProblem !== null) fail('validation', tagProblem, 'tags');
  const backend =
    core.state.backends.find((candidate) => candidate.id === input.backend) ??
    fail('validation', `バックエンド「${input.backend}」は使えません`, 'backend');
  if (input.autonomyIntervalMin < AUTONOMY_INTERVAL_MIN) {
    fail('validation', `自発活動の間隔は${AUTONOMY_INTERVAL_MIN}分以上にしてください`, 'autonomyIntervalMin');
  }
  return {
    ...input,
    name: input.name.trim(),
    tags: cleanTags(input.tags),
    permissions: supportedPermissions(rolePermissions(core.state.templates, input.tags), backend),
    backendOptions: pickOptions(backend, input),
  };
}
