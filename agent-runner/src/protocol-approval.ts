export type OperationApproval = {
  operation: string;
  workspace: string;
  detail: string;
  reason: string;
};

export type ApprovalDecision = 'approved' | 'denied';
export type ApprovalOutcome = ApprovalDecision | 'timedOut' | 'cancelled';

export type ApprovalResponse = {
  type: 'approvalResponse';
  id: string;
  requestId: string;
  decision: ApprovalDecision;
};

export type ApprovalEvent =
  | ({ type: 'approvalRequested'; id: string; requestId: string; timeoutMs: number } & OperationApproval)
  | { type: 'approvalResolved'; id: string; requestId: string; outcome: ApprovalOutcome };
