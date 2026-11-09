//! 作業中の投稿: バックエンドの投稿のしかたに合わせた案内と、会話の履歴での途中経過の印。

use guild_domain::agent::{effective_permissions, Agent};
use guild_domain::author::Author;
use guild_domain::backend::{BackendInfo, MidRunPost};
use guild_domain::conversation::{JobMode, JobSpec};
use guild_domain::ids::AgentId;
use guild_domain::message::{Message, MessageKind};
use guild_domain::profile::Profile;
use guild_domain::prompt::{build_conversation_prompt, build_system_prompt, PromptContext};

use super::support::{agent, backend, by, channel, message};

const RULE: &str = "作業しているときは最低でも1分に1メッセージ、進捗状況や困っていることを投稿すること。";

/// ハル（バックエンドは claude）のシステムプロンプトと、history に応える会話プロンプト
fn prompts(mid_run_post: Option<MidRunPost>, history: &[Message]) -> (String, String) {
    let agents: Vec<Agent> = vec![agent("haru", "worker", "ハル"), agent("logica", "expert", "ロジカ")];
    let backends: Vec<BackendInfo> = vec![BackendInfo { mid_run_post, ..backend("claude") }];
    let lobby = channel("c1", &["me", "haru", "logica"]);
    let me = Profile::default();
    let ctx = PromptContext {
        agent: &agents[0],
        permissions: effective_permissions(&agents[0], None),
        channel: &lobby,
        agents: &agents,
        backends: &backends,
        me: &me,
        skills: &[],
        memory: "",
        now_label: "",
        time_label: &|ms| format!("t{ms}"),
        attachment_path: &|_, _| String::new(),
        delegation: None,
    };
    let conversation = match history.last() {
        Some(trigger) => {
            let job = JobSpec::respond(AgentId::new("haru"), trigger, JobMode::Reply, Vec::new());
            build_conversation_prompt(&ctx, history, &job, &[])
        }
        None => String::new(),
    };
    (build_system_prompt(&ctx), conversation)
}

#[test]
fn tool_backends_are_told_to_use_the_post_tool() {
    let (system, _) = prompts(Some(MidRunPost::Tool), &[]);
    assert!(
        system.contains(&format!("## 作業中の投稿\n- {RULE}\n- 途中で投稿するには post ツールを使ってください。")),
        "{system}"
    );
    assert!(system.contains("途中の投稿でメンションしても相手には通知されない"));
}

#[test]
fn text_backends_are_told_that_text_before_a_tool_is_posted() {
    let (system, _) = prompts(Some(MidRunPost::Text), &[]);
    assert!(system.contains(RULE));
    assert!(system.contains("ツールを使う前に文章を書いてください。そのあとに作業が続いた文章は、途中の投稿としてそのままチャットに出ます。"));
    assert!(!system.contains("post ツール"));
}

#[test]
fn backends_that_cannot_post_mid_run_get_no_posting_rule() {
    let (system, _) = prompts(None, &[]);
    assert!(!system.contains("## 作業中の投稿"));
    assert!(!system.contains(RULE));
    assert!(system.ends_with("（何も投稿されません）。\n"), "{system}");
}

#[test]
fn progress_posts_are_marked_in_the_history() {
    let mut progress = message(2, by("logica"), "進捗: 半分まで読みました");
    progress.kind = MessageKind::Progress;
    let history =
        [message(1, Author::Human, "@ロジカ @ハル 見て"), progress, message(3, by("logica"), "@ハル 終わりました")];
    let (_, conversation) = prompts(Some(MidRunPost::Tool), &history);
    assert!(conversation.contains("[t0] ロジカ（途中経過）:\n進捗: 半分まで読みました"), "{conversation}");
    assert!(conversation.contains("[t0] ロジカ:\n@ハル 終わりました"));
}
