//! 同じ発言を二度載せない: 下の節に全文を載せる発言は、履歴では発言者・時刻・順序だけを残す。

use guild_domain::attachment::NewAttachment;
use guild_domain::author::Author;
use guild_domain::conversation::{JobMode, JobSpec};
use guild_domain::delegation::{DelegationStatus, SubtaskStatus};
use guild_domain::ids::{AgentId, AttachmentId, DelegationId, MessageId};
use guild_domain::locale::Language;
use guild_domain::message::Message;

use super::prompt_fixture::{build, delegation, history, report_job, task_job};
use super::support::{by, message};

const PENDING_REF: &str = "（下の「あなた宛ての未対応の発言」に全文）";
const RESULT_REF: &str = "（下の「割り振ったタスクの結果がそろいました」に全文）";

fn history_part(conversation: &str) -> &str {
    let end = ["\n# あなた宛ての未対応の発言", "\n# 割り振ったタスクの結果"]
        .iter()
        .filter_map(|heading| conversation.find(heading))
        .min()
        .unwrap_or(conversation.len());
    &conversation[..end]
}

#[test]
fn a_task_job_keeps_the_assignment_and_references_the_trigger_once() {
    let history = history();
    let job = task_job(&history);
    let running = delegation([SubtaskStatus::Running, SubtaskStatus::Pending]);
    for (voice, language) in [("auto", Language::Ja), ("off", Language::Ja), ("auto", Language::En)] {
        let (_, prompt) = build("haru", voice, language, &history[..3], &job, Some(&running));
        let body = &history[2].content;
        assert_eq!(prompt.matches(body.as_str()).count(), 1, "{voice} {language:?}: 割り振りの発言は1回だけ");
        let past = history_part(&prompt);
        assert!(past.contains(&history[0].content), "起点は履歴に残す");
        assert!(
            past.contains("[t0] カナメ:\n了解、確認します\n\n[t0] カナメ:\n（下の「あなた宛ての未対応の発言」に全文）")
        );
        assert!(prompt.contains(&format!("# あなた宛ての未対応の発言\n[t0] カナメ:\n{body}")));
        assert!(
            prompt.contains(
                "# あなたの番です（割り振られたタスク）\nカナメ から割り振られたタスクです:\n> 【haruへの指示】"
            ),
            "割り振りの正式な指示は残す"
        );
        if language == Language::En {
            let tail: String = prompt.chars().rev().take(120).collect::<Vec<_>>().into_iter().rev().collect();
            assert!(tail.contains("English"), "{tail}");
        }
    }
}

#[test]
fn a_report_job_references_the_results_and_keeps_other_messages() {
    let history = history();
    let job = report_job(&history);
    let mut done = delegation([SubtaskStatus::Done, SubtaskStatus::Done]);
    done.status = DelegationStatus::Reporting;
    let (_, prompt) = build("kaname", "auto", Language::Ja, &history, &job, Some(&done));
    for result in &history[5..7] {
        assert_eq!(prompt.matches(result.content.as_str()).count(), 1, "結果は結果の節にだけ");
    }
    let past = history_part(&prompt);
    assert_eq!(past.matches(RESULT_REF).count(), 2);
    assert!(!past.contains(PENDING_REF));
    assert!(past.contains("ハル（途中経過）:\n調査を始めます") && past.contains("ロジカ:\n相談の答えです"));
    assert!(past.contains(&history[2].content), "まとめでは割り振りの発言は履歴に全文");
    assert!(
        prompt.contains("## 1. @ハル（完了）\n指示:\n> 【haruへの指示】") && prompt.contains("結果:\nハルの結果。")
    );

    let other = delegation([SubtaskStatus::Done, SubtaskStatus::Done]);
    let mut mismatched = job.clone();
    mismatched.report = Some(DelegationId::new("d2"));
    let (_, prompt) = build("kaname", "auto", Language::Ja, &history, &mismatched, Some(&other));
    assert!(!prompt.contains(RESULT_REF), "結果の節を出さないときは履歴に全文を残す");
    assert!(prompt.contains(&history[5].content));
}

/// 人間の発言に応えるジョブ: ルートが違う複数のきっかけ、添付のある発言
#[test]
fn several_triggers_across_roots_keep_their_order_speakers_and_attachments() {
    let mut first = message(10, Author::Human, &"一つ目の依頼。".repeat(50));
    let png = NewAttachment { name: "a.png".to_owned(), media_type: "image/png".to_owned(), bytes: vec![1] };
    first.attachments = vec![png.describe(AttachmentId::new("i1"))];
    first.created_at = 10;
    let between = Message { created_at: 11, ..message(11, by("sora"), "横から失礼") };
    let mut second = message(12, Author::Human, &"二つ目の依頼。".repeat(50));
    second.root_id = MessageId::new("m12");
    second.created_at = 12;
    let history = vec![first.clone(), between, second.clone()];
    let mut job = JobSpec::respond(AgentId::new("haru"), &first, JobMode::Reply, Vec::new());
    job.triggers.push(second.clone());
    let (_, prompt) = build("haru", "auto", Language::Ja, &history, &job, None);
    let past = history_part(&prompt);
    let expected = format!(
        "[t10] ユーザー（人間）（画像 1 枚）:\n{PENDING_REF}\n\n[t11] ソラ:\n横から失礼\n\n[t12] ユーザー（人間）:\n{PENDING_REF}"
    );
    assert!(past.contains(&expected), "{past}");
    for trigger in [&first, &second] {
        assert_eq!(prompt.matches(trigger.content.as_str()).count(), 1);
    }
    assert!(prompt
        .contains(&format!("# あなた宛ての未対応の発言\n[t10] ユーザー（人間）（画像 1 枚）:\n{}", first.content)));
    assert!(prompt.contains("# 添付画像\n") && prompt.contains("- [t10] ユーザー（人間） の発言: 1 枚"));
}

/// きっかけのない自発活動は、履歴をそのまま載せる
#[test]
fn autonomous_jobs_keep_the_history_as_is() {
    let history = history();
    let job = JobSpec::autonomous(AgentId::new("haru"), history[0].channel_id.clone());
    let (_, prompt) = build("haru", "auto", Language::Ja, &history[..3], &job, None);
    assert!(!prompt.contains(PENDING_REF) && prompt.contains(&history[2].content));
}
