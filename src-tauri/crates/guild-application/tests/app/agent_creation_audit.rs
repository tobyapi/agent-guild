use crate::support::runtime::reply;
use crate::support::TestApp;

#[tokio::test]
async fn creation_audit_records_trusted_actor_and_safe_claims_without_payload() {
    for (role, extra, expected) in [
        ("manager", "", "accepted"),
        ("worker", "", "manager_required"),
        ("manager", ",\"actorId\":\"forged-manager\"", "invalid_request"),
        ("manager", ",\"role\":\"private sentinel with spaces\"", "invalid_request"),
    ] {
        let app = TestApp::new();
        let actor = app.agent(role, "Actor");
        let channel = app.channel("work", &[&actor]);
        let json = format!(
            r#"{{"requestId":"audit-1","name":"NewAgent","template":"worker","backend":"claude","personality":"private sentinel with spaces"{extra}}}"#
        );
        app.runtime.script(actor.id.as_str(), reply(&format!("Requested.\n\n```create-agent\n{json}\n```")));
        app.services.conversation.send_human_message(&channel.id, "create", &[]).unwrap();
        app.settle().await;
        let audit = app.store.creation_audit.lock();
        assert_eq!(audit.len(), 1);
        assert_eq!(audit[0].0, actor.id);
        assert_eq!(audit[0].1, expected);
        assert!(!audit[0].2.contains("private sentinel"));
        if extra.contains("actorId") {
            assert_eq!(audit[0].2, "actorId=forged-manager");
        }
        if extra.contains("role") {
            assert_eq!(audit[0].2, "role=redacted");
        }
        println!("AUDIT principal={} reason={} claims={}", audit[0].0, audit[0].1, audit[0].2);
    }
}
