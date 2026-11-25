import type { ApprovalStatus, OperationApproval } from '../domain';
import { number, objectOf, oneOf, string, type Schema } from '../schema';

export const operationApprovalSchema = objectOf({
  runId: string,
  channelId: string,
  requestId: string,
  agentName: string,
  operation: string,
  workspace: string,
  detail: string,
  reason: string,
  timeoutMs: number,
  status: oneOf<ApprovalStatus>({ pending: true, approved: true, denied: true, timedOut: true, cancelled: true }),
} satisfies Schema<OperationApproval>);
