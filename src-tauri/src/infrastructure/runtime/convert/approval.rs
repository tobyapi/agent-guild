use runner_client as runner;

pub(super) fn approval_request(request: runner::ApprovalRequest) -> guild_domain::operation_approval::ApprovalRequest {
    guild_domain::operation_approval::ApprovalRequest {
        request_id: request.request_id,
        operation: request.operation,
        workspace: request.workspace,
        detail: request.detail,
        reason: request.reason,
        timeout_ms: request.timeout_ms,
    }
}

pub(super) fn approval_status(outcome: runner::ApprovalOutcome) -> guild_domain::operation_approval::ApprovalStatus {
    use guild_domain::operation_approval::ApprovalStatus;
    match outcome {
        runner::ApprovalOutcome::Approved => ApprovalStatus::Approved,
        runner::ApprovalOutcome::Denied => ApprovalStatus::Denied,
        runner::ApprovalOutcome::TimedOut => ApprovalStatus::TimedOut,
        runner::ApprovalOutcome::Cancelled => ApprovalStatus::Cancelled,
    }
}

pub(in crate::infrastructure::runtime) fn approval_decision(
    decision: guild_domain::operation_approval::ApprovalDecision,
) -> runner::ApprovalDecision {
    use guild_domain::operation_approval::ApprovalDecision;
    match decision {
        ApprovalDecision::Approved => runner::ApprovalDecision::Approved,
        ApprovalDecision::Denied => runner::ApprovalDecision::Denied,
    }
}
