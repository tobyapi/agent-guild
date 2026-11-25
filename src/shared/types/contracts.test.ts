// 契約の実例（contracts/ipc/*.json）が domain.ts の型に合うことを検査する。
// JSON を import すると文字列の型が広がって satisfies が効かないので、Schema<T> で値を検証する。
import { describe, expect, it } from 'vitest';
import { arrayOf, boolean, nullValue, objectOf, string } from './schema';
import type { Validator } from './schema';
import { parseCandidate } from '@/shared/theme/candidate';
import { delegationSchema } from './schemas/delegation';
import { agentInputSchema, messageSchema } from './schemas/entities';
import {
  builtinSkillSchema,
  skillInputSchema,
  skillLibrarySchema,
  skillSchema,
  skillsChangedSchema,
} from './schemas/skills';
import { channelStatisticsSchema } from './schemas/statistics';
import {
  activityStateSchema,
  bootStatusSchema,
  commandErrorSchema,
  runLimitsSchema,
  snapshotSchema,
  storageInfoSchema,
  updateStatusSchema,
} from './schemas/system';

import { operationApprovalSchema } from './schemas/operationApproval';

const fixtures = import.meta.glob<unknown>('/contracts/ipc/*.json', { eager: true, import: 'default' });

const themeCandidate: Validator = (value) => {
  parseCandidate(JSON.stringify(value));
  return [];
};

const CASES: Record<string, Validator> = {
  'global-instructions.json': string,
  'run-limits.json': objectOf(runLimitsSchema),
  'skill-record-truncated.json': boolean,
  'desktop-notifications.json': boolean,
  'theme-candidate.json': themeCandidate,
  'mascot-images.json': objectOf({
    generate: objectOf({
      args: objectOf({ requestId: string, backendId: string, description: string }),
      result: string,
    }),
    list: objectOf({ args: objectOf({}), result: arrayOf(string) }),
    get: objectOf({ args: objectOf({ id: string }), result: string }),
  }),
  'open-local-path.json': objectOf({
    markdown: string,
    args: objectOf({ path: string, reveal: boolean }),
    result: nullValue,
  }),
  'snapshot.json': objectOf(snapshotSchema),
  'channel-statistics.json': objectOf(channelStatisticsSchema),
  'agent-input.json': objectOf(agentInputSchema),
  'messages.json': arrayOf(objectOf(messageSchema)),
  'skill.json': objectOf(skillSchema),
  'skill-linked.json': objectOf(skillSchema),
  'skill-builtin.json': objectOf(skillSchema),
  'builtin-skills.json': arrayOf(objectOf(builtinSkillSchema)),
  'skill-library.json': objectOf(skillLibrarySchema),
  'operation-approval.json': operationApprovalSchema,
  'delegation.json': objectOf(delegationSchema),
  'skill-input.json': objectOf(skillInputSchema),
  'activity-state.json': objectOf(activityStateSchema),
  'skills-changed.json': objectOf(skillsChangedSchema),
  'storage-info.json': objectOf(storageInfoSchema),
  'update-status.json': objectOf(updateStatusSchema),
  'boot-status-recovery.json': objectOf(bootStatusSchema),
  'command-error.json': objectOf(commandErrorSchema),
};

const fileName = (path: string) => path.slice(path.lastIndexOf('/') + 1);

describe('contracts/ipc', () => {
  it.each(Object.entries(CASES))('%s が契約の型に合う', (file, validate) => {
    const fixture = fixtures[`/contracts/ipc/${file}`];
    expect(fixture, `${file} が見つかりません`).toBeDefined();
    expect(validate(fixture, file)).toEqual([]);
  });

  it('すべてのフィクスチャに検査がある（フィクスチャを足したらここにも足す）', () => {
    expect(Object.keys(fixtures).map(fileName).sort()).toEqual(Object.keys(CASES).sort());
  });
});
