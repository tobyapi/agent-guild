// 契約の実例（contracts/ipc/*.json）が domain.ts の型に合うことを検査する。
// JSON を import すると文字列の型が広がって satisfies が効かないので、Schema<T> で値を検証する。
import { describe, expect, it } from 'vitest';
import { arrayOf, objectOf } from './schema';
import type { Validator } from './schema';
import { delegationSchema } from './schemas/delegation';
import { agentInputSchema, messageSchema } from './schemas/entities';
import { skillInputSchema, skillLibrarySchema, skillSchema, skillsChangedSchema } from './schemas/skills';
import { channelStatisticsSchema } from './schemas/statistics';
import {
  activityStateSchema,
  bootStatusSchema,
  commandErrorSchema,
  snapshotSchema,
  storageInfoSchema,
} from './schemas/system';

const fixtures = import.meta.glob<unknown>('/contracts/ipc/*.json', { eager: true, import: 'default' });

const CASES: Record<string, Validator> = {
  'snapshot.json': objectOf(snapshotSchema),
  'channel-statistics.json': objectOf(channelStatisticsSchema),
  'agent-input.json': objectOf(agentInputSchema),
  'messages.json': arrayOf(objectOf(messageSchema)),
  'skill.json': objectOf(skillSchema),
  'skill-linked.json': objectOf(skillSchema),
  'skill-library.json': objectOf(skillLibrarySchema),
  'delegation.json': objectOf(delegationSchema),
  'skill-input.json': objectOf(skillInputSchema),
  'activity-state.json': objectOf(activityStateSchema),
  'skills-changed.json': objectOf(skillsChangedSchema),
  'storage-info.json': objectOf(storageInfoSchema),
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
