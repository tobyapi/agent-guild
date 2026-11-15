//! 道具の有無に依存しない会話文体の指示。性格・口調と同じ実行プロンプトへ渡す。

use crate::agent::Agent;
use crate::voice::{appearance_guide, mode_card, selection_guide, voice_modes};

pub(super) fn section(agent: &Agent) -> String {
    if agent.voice.mode == "off" {
        return "## 会話の表現\n保存設定は「いつもの口調」です。基本の性格・口調で応答してください。\n".to_owned();
    }
    let guide = selection_guide();
    let appearance = appearance_guide();
    let mut text = format!(
        "## 会話の表現\n上記の性格・口調・一人称・関係性を維持してください。文体は発言の表現だけに適用し、仕事の内容、権限、必須の出力形式は変えません。\n保存された強度: {}\n{guide}\n表示先: agent-guild のチャット。以下の専用構文に対応しています。見た目は発言ごとに判断し、装飾なしも選べます。表示のためのスキル登録やツール実行は不要です。\n{appearance}\n",
        agent.voice.intensity.label()
    );
    text.push_str("保存設定は自動です。会話履歴と今回の用件から、必要なら一つを選んで今回の返答だけに使います。\n");
    text.push_str(&available_modes());
    text
}

/// 自動選択の候補を名前と操作で示す。
fn available_modes() -> String {
    let mut text = "### 文体の候補と操作\n".to_owned();
    for mode in voice_modes() {
        let card = mode_card(&mode);
        let operation = card_section(&card, "## 会話で実行する操作");
        let appearance = card_section(&card, "## 見た目の使い分け");
        text.push_str(&format!(
            "- {}（別名: {}）: {operation}\n表示の使い分け:\n{appearance}\n",
            mode.title,
            mode.aliases.join(" / ")
        ));
    }
    text
}

fn card_section<'a>(card: &'a str, heading: &str) -> &'a str {
    card.split(heading).nth(1).and_then(|rest| rest.split("\n## ").next()).unwrap_or("").trim()
}
