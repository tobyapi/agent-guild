export type ApprovalDecision = 'approved' | 'denied';
export type ApprovalStatus = 'pending' | ApprovalDecision | 'timedOut' | 'cancelled';

export interface OperationApproval {
  runId: string;
  channelId: string;
  requestId: string;
  agentName: string;
  operation: string;
  workspace: string;
  detail: string;
  reason: string;
  timeoutMs: number;
  status: ApprovalStatus;
}
