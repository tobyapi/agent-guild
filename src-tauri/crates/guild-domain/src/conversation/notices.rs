//! システム発言と注記の文面（作った時点の言語で保存する。あとで言語を変えても書き換えない）。
//! 文面は contracts/behavior/notices.json で TS のモック（src/shared/api/mock/notices.ts）と同じであることを検査する。

use crate::locale::Language;

/// 名前を並べる区切り
fn list(language: Language, names: &[String]) -> String {
    names.join(language.pick(["・", ", ", "、", "、", ", "]))
}

/// 停止したとき
pub fn stopped(language: Language) -> &'static str {
    language.pick(["停止しました", "Stopped.", "已停止。", "已停止。", "중지했습니다."])
}

/// depth が上限に達して振り分けを止めたとき（起点ごとに1回）
pub fn depth_limit(language: Language) -> &'static str {
    language.pick([
        "AI 同士の往復が上限に達したので止めました。続けるにはメンションしてください。",
        "Stopped because the back-and-forth between AIs reached its limit. Mention someone to continue.",
        "AI 之间的往返次数已达上限，已停止。如需继续，请提及成员。",
        "AI 之間的往返次數已達上限，已停止。如需繼續，請提及成員。",
        "AI 간 대화가 한도에 도달하여 멈췄습니다. 계속하려면 멘션하세요.",
    ])
}

/// メンションなしの人間の発言に答えられるエージェントがいないとき
pub fn no_responder(language: Language) -> &'static str {
    language.pick([
        "いま返答できるエージェントがいません（バックエンドの準備ができていないか、答える設定のメンバーがいません）",
        "No agent can reply right now (the backend isn't ready, or no member is set to answer).",
        "目前没有可以回复的智能体（后端尚未就绪，或没有设置为回答的成员）。",
        "目前沒有可以回覆的代理人（後端尚未就緒，或沒有設定為回答的成員）。",
        "지금 답할 수 있는 에이전트가 없습니다(백엔드가 준비되지 않았거나, 답하도록 설정된 멤버가 없습니다).",
    ])
}

/// ジョブが時間切れになったとき（そのエージェント名義の error 発言）
pub fn timed_out(language: Language) -> &'static str {
    language.pick([
        "時間切れで中断しました（15分）",
        "Stopped because it took too long (15 minutes).",
        "已超时中断（15 分钟）。",
        "已逾時中斷（15 分鐘）。",
        "시간이 초과되어 중단했습니다(15분).",
    ])
}

/// 前回アプリが終了したときに、待っていた・実行中だった返答が消えたとき（次の起動時に会話ごとに1回）
pub fn interrupted(language: Language, names: &[String]) -> String {
    let names = list(language, names);
    match language {
        Language::Ja => format!(
            "前回アプリが終了したときに、{names}の返答が中断されました。続けるには、もう一度話しかけてください。"
        ),
        Language::En => {
            format!(
                "The reply from {names} was interrupted when the app last closed. Send a message again to continue."
            )
        }
        Language::ZhHans => format!("上次关闭应用时，{names} 的回复被中断了。如需继续，请再发一次消息。"),
        Language::ZhHant => format!("上次關閉應用程式時，{names} 的回覆被中斷了。如需繼續，請再傳一次訊息。"),
        Language::Ko => {
            format!("지난번 앱이 종료될 때 {names} 님의 답변이 중단되었습니다. 계속하려면 다시 말을 걸어 주세요.")
        }
    }
}

/// チャンネル外のエージェントが呼ばれて自動で参加したとき
pub fn joined(language: Language, name: &str) -> String {
    match language {
        Language::Ja => format!("{name} がチャンネルに参加しました"),
        Language::En => format!("{name} joined the channel."),
        Language::ZhHans => format!("{name} 加入了频道。"),
        Language::ZhHant => format!("{name} 加入了頻道。"),
        Language::Ko => format!("{name} 님이 채널에 참여했습니다."),
    }
}

/// メンションされた相手がチャンネルにおらず、consultable でもない（自動参加しない）とき
pub fn undeliverable(language: Language, name: &str) -> String {
    match language {
        Language::Ja => format!("{name} はこのチャンネルにいないため、メッセージは届きませんでした"),
        Language::En => format!("{name} is not in this channel, so the message was not delivered."),
        Language::ZhHans => format!("{name} 不在此频道中，消息未送达。"),
        Language::ZhHant => format!("{name} 不在此頻道中，訊息未送達。"),
        Language::Ko => format!("{name} 님은 이 채널에 없어서 메시지가 전달되지 않았습니다."),
    }
}

/// tasks ブロックに割り振れない名前があったとき
pub fn unassignable(language: Language, names: &[String]) -> String {
    let names = list(language, names);
    match language {
        Language::Ja => format!("{names} には割り振れませんでした（見つからないか、自分自身です）"),
        Language::En => format!("Could not delegate to {names} (not found, or it is yourself)."),
        Language::ZhHans => format!("无法分派给 {names}（找不到，或是自己）。"),
        Language::ZhHant => format!("無法分派給 {names}（找不到，或是自己）。"),
        Language::Ko => format!("{names} 님에게는 위임할 수 없었습니다(찾을 수 없거나 자기 자신입니다)."),
    }
}

/// サブタスクが上限を超えたとき
pub fn too_many_tasks(language: Language, names: &[String]) -> String {
    let max = crate::delegation::MAX_SUBTASKS;
    let names = list(language, names);
    match language {
        Language::Ja => format!("サブタスクは{max}件までです。{names} への割り振りは飛ばしました"),
        Language::En => format!("Up to {max} subtasks are allowed. Skipped delegating to {names}."),
        Language::ZhHans => format!("子任务最多 {max} 个。已跳过对 {names} 的分派。"),
        Language::ZhHant => format!("子任務最多 {max} 個。已略過對 {names} 的分派。"),
        Language::Ko => format!("하위 작업은 {max}개까지입니다. {names} 님에 대한 위임은 건너뛰었습니다."),
    }
}

/// 相談相手が [PASS] または空の返答で終わったときの注記
pub fn did_not_answer(language: Language, name: &str) -> String {
    match language {
        Language::Ja => format!("{name} は回答しませんでした"),
        Language::En => format!("{name} did not answer."),
        Language::ZhHans => format!("{name} 没有回答。"),
        Language::ZhHant => format!("{name} 沒有回答。"),
        Language::Ko => format!("{name} 님은 답하지 않았습니다."),
    }
}

/// 相談相手の実行が失敗・時間切れで終わったときの注記
pub fn failed(language: Language, name: &str) -> String {
    match language {
        Language::Ja => format!("{name} は失敗しました"),
        Language::En => format!("{name} failed."),
        Language::ZhHans => format!("{name} 执行失败。"),
        Language::ZhHant => format!("{name} 執行失敗。"),
        Language::Ko => format!("{name} 님은 실패했습니다."),
    }
}
