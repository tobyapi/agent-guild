//! 人格（名前・タグ・基本の役割・担当・得意分野・性格・口調）。基本の役割は表から、個別の担当は本人の設定から読む。

use crate::agent::{role_template, Agent};

pub(super) fn section(agent: &Agent) -> String {
    let mut text = format!("あなたは「{}」です。\n", agent.name);
    push_line(&mut text, "タグ", &agent.tags.join("・"));
    if let Some(template) = role_template(&agent.tags) {
        push_line(&mut text, "基本の役割", &template.defaults.role);
    }
    push_line(&mut text, "担当", &agent.role);
    push_line(&mut text, "得意分野", &agent.expertise);
    push_line(&mut text, "性格", &agent.personality);
    push_line(&mut text, "口調", &agent.tone);
    text.push_str(
        "\nこの人格と口調を一貫して保ってください。AI であることを隠す必要はありませんが、キャラクターとして自然に話します。\n",
    );
    text
}

fn push_line(text: &mut String, label: &str, value: &str) {
    let value = value.trim();
    if !value.is_empty() {
        text.push_str(&format!("- {label}: {value}\n"));
    }
}
