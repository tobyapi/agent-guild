//! 選択肢ボタン（a2ui ブロック）: 全員共通の指示に見本が1つ入り、ブロックの後ろの notify・skill-usage は今までどおり読める。

use guild_domain::desktop_notification::extract;
use guild_domain::locale::Language;
use guild_domain::skill_usage::declaration;

use super::prompt_fixture::{build, history, task_job};

const BLOCK: &str = "```a2ui\n{\"version\":\"1.0\",\"createSurface\":{\"surfaceId\":\"s\"}}\n```";

#[test]
fn choices_rule_has_one_sample_block_in_the_output_rules() {
    let history = history();
    let job = task_job(&history);
    for subject in ["haru", "kaname"] {
        let (system, _) = build(subject, "off", Language::Ja, &history[..3], &job, None);
        assert_eq!(system.matches("```a2ui\n").count(), 1, "{subject}");
        let rules = &system[system.find("## 出力のルール").unwrap()..];
        assert!(rules.contains("人間に3択を尋ねる最終返答"), "{subject}");
        assert!(rules.contains("notify と skill-usage はこのブロックの後"), "{subject}");
        assert!(rules.contains("\"catalogId\":\"https://a2ui.org/specification/v1_0/catalogs/basic/catalog.json\""));
    }
}

#[test]
fn skill_usage_and_notify_after_a2ui_block_are_still_read() {
    let raw = format!(
        "どこまで進める？\n\n{BLOCK}\n\n```notify\n選んでください\n```\n\n```skill-usage\n[\"clean-code\"]\n```"
    );
    let (body, names) = declaration(&raw);
    assert_eq!(names, vec!["clean-code".to_owned()]);
    let (text, request) = extract(&body).unwrap();
    assert_eq!(request.body, "選んでください");
    assert_eq!(text, format!("どこまで進める？\n\n{BLOCK}"));
}

#[test]
fn a2ui_block_after_notify_hides_the_notification() {
    // 順番を守らないと通知は読まれない（指示文で「notify はブロックの後」と書く理由）
    let raw = format!("どこまで進める？\n\n```notify\n選んでください\n```\n\n{BLOCK}");
    assert!(extract(&raw).is_none());
}
