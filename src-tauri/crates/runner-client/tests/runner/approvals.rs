use runner_client::{ApprovalDecision, ApprovalOutcome, RunUpdate};

use crate::support::{ready_client, request, updates, within};

#[tokio::test]
async fn approval_updates_and_responses_are_relayed_for_the_active_run() {
    let client = ready_client("ok.mjs").await;
    let (sink, mut mailbox) = updates();
    let run = client.run("approval-job", request("approvals"), sink);
    let driver = async {
        for request_id in ["first", "second"] {
            let Some(RunUpdate::ApprovalRequested(request)) = mailbox.recv().await else {
                panic!("missing approval request");
            };
            assert_eq!(request.request_id, request_id);
            assert_eq!(request.detail, format!("echo {request_id}"));
            assert_eq!(request.timeout_ms, 600_000);
        }
        assert!(!client.respond_to_approval("other-job", "first", ApprovalDecision::Approved).await.unwrap());
        assert!(client.respond_to_approval("approval-job", "first", ApprovalDecision::Denied).await.unwrap());
        assert_eq!(mailbox.recv().await, Some(RunUpdate::ApprovalResolved("first".into(), ApprovalOutcome::Denied)));
        assert!(client.respond_to_approval("approval-job", "second", ApprovalDecision::Approved).await.unwrap());
        assert_eq!(mailbox.recv().await, Some(RunUpdate::ApprovalResolved("second".into(), ApprovalOutcome::Approved)));
    };
    let (result, ()) = within(async { tokio::join!(run, driver) }).await;
    assert_eq!(result.unwrap(), "approved");
    assert!(!client.respond_to_approval("approval-job", "second", ApprovalDecision::Approved).await.unwrap());
    client.shutdown().await;
}
