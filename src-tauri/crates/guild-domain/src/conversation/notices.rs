//! システム発言と注記の文面。

/// 停止したとき
pub const STOPPED: &str = "停止しました";

/// depth が上限に達して振り分けを止めたとき（起点ごとに1回）
pub const DEPTH_LIMIT: &str =
    "AI 同士の往復が上限に達したので止めました。続けるにはメンションしてください。";

/// メンションなしの人間の発言に答えられるエージェントがいないとき
pub const NO_RESPONDER: &str =
    "いま返答できるエージェントがいません（バックエンドの準備ができていないか、答える設定のメンバーがいません）";

/// ジョブが時間切れになったとき（そのエージェント名義の error 発言）
pub const TIMED_OUT: &str = "時間切れで中断しました（15分）";

/// 前回アプリが終了したときに、待っていた・実行中だった返答が消えたとき（次の起動時に会話ごとに1回）
pub fn interrupted(names: &[String]) -> String {
    format!(
        "前回アプリが終了したときに、{}の返答が中断されました。続けるには、もう一度話しかけてください。",
        names.join("・")
    )
}

/// チャンネル外のエージェントが呼ばれて自動で参加したとき
pub fn joined(name: &str) -> String {
    format!("{name} がチャンネルに参加しました")
}

/// メンションされた相手がチャンネルにおらず、consultable でもない（自動参加しない）とき
pub fn undeliverable(name: &str) -> String {
    format!("{name} はこのチャンネルにいないため、メッセージは届きませんでした")
}

/// tasks ブロックに割り振れない名前があったとき
pub fn unassignable(names: &[String]) -> String {
    format!("{} には割り振れませんでした（見つからないか、自分自身です）", names.join("・"))
}

/// サブタスクが上限を超えたとき
pub fn too_many_tasks(names: &[String]) -> String {
    format!(
        "サブタスクは{}件までです。{} への割り振りは飛ばしました",
        crate::delegation::MAX_SUBTASKS,
        names.join("・")
    )
}

/// 相談相手が [PASS] または空の返答で終わったときの注記
pub fn did_not_answer(name: &str) -> String {
    format!("{name} は回答しませんでした")
}

/// 相談相手の実行が失敗・時間切れで終わったときの注記
pub fn failed(name: &str) -> String {
    format!("{name} は失敗しました")
}
