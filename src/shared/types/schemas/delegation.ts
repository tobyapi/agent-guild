// domain の割り振り（マネージャーのタスク。docs/design.md §7.1）のスキーマ。
import type { Delegation, DelegationStatus, Subtask, SubtaskStatus } from '../domain';
import { arrayOf, nullable, number, objectOf, oneOf, string } from '../schema';
import type { Schema } from '../schema';

export const subtaskSchema = {
  id: string,
  assigneeId: string,
  instruction: string,
  status: oneOf<SubtaskStatus>({ pending: true, running: true, done: true, failed: true, cancelled: true }),
  resultMessageId: nullable(string),
  note: nullable(string),
} satisfies Schema<Subtask>;

export const delegationSchema = {
  id: string,
  channelId: string,
  managerId: string,
  messageId: string,
  status: oneOf<DelegationStatus>({ running: true, reporting: true, done: true, cancelled: true }),
  subtasks: arrayOf(objectOf(subtaskSchema)),
  summaryMessageId: nullable(string),
  createdAt: number,
  updatedAt: number,
} satisfies Schema<Delegation>;
