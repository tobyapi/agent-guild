use guild_domain::agent::{find_template, role_can_notify};
use guild_domain::desktop_notification::extract;

#[test]
fn notification_requests_follow_shared_examples() {
    let cases: serde_json::Value =
        serde_json::from_str(include_str!("../../../../../contracts/behavior/notifies.json")).unwrap();
    for case in cases.as_array().unwrap() {
        let actual = extract(case["content"].as_str().unwrap())
            .map(|(text, request)| serde_json::json!({"body":request.body,"text":text}));
        assert_eq!(actual.unwrap_or(serde_json::Value::Null), case["request"], "{}", case["name"]);
    }
}

#[test]
fn notification_permission_uses_first_role_tag_in_all_languages() {
    for template in guild_domain::agent::templates() {
        for tag in &template.role_tags {
            assert_eq!(role_can_notify(std::slice::from_ref(tag)), template.id == "manager");
        }
    }
    assert!(!role_can_notify(&[]));
    assert!(!role_can_notify(&["独自タグ".to_owned()]));
    let worker = find_template("worker").unwrap().defaults.tags[0].clone();
    let manager = find_template("manager").unwrap().defaults.tags[0].clone();
    assert!(!role_can_notify(&[worker, manager]));
}
