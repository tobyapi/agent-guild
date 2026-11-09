// エージェントの入力の検証と正規化（docs/design.md §2 入力規則をモック用に）。
import { AUTONOMY_INTERVAL_MIN } from '@/shared/lib/limits';
import { checkMemberName } from '@/shared/lib/names';
import { permissionRuleProblem } from '@/shared/lib/permissions';
import { checkTags, cleanTags } from '@/shared/lib/tags';
import type { AgentInput, BackendInfo, OptionSpec } from '@/shared/types/domain';
import { activeAgents, fail } from '../runtime';
import type { MockCore } from '../runtime';

function matchesType(spec: OptionSpec, value: unknown): boolean {
  if (spec.type === 'select') return typeof value === 'string' && spec.choices.includes(value);
  return typeof value === spec.type;
}

/** backendOptions は選んだバックエンドの OptionSpec に合う値だけを残す（未知のキーは捨てる） */
function pickOptions(backend: BackendInfo, values: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(values).filter(([key, value]) =>
      backend.options.some((spec) => spec.key === key && matchesType(spec, value)),
    ),
  );
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
  const rule = permissionRuleProblem(backend, input.permissions);
  if (rule !== null) fail('validation', rule.message, rule.field);
  return {
    ...input,
    name: input.name.trim(),
    tags: cleanTags(input.tags),
    backendOptions: pickOptions(backend, input.backendOptions),
  };
}
