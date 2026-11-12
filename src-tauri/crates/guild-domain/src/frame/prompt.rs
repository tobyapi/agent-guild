//! 枠の生成を頼むプロンプト。利用者が Codex に直接頼むときと同じく、内蔵スキル `ornate-avatar-frame`
//! （`src/shared/assets/skills/ornate-avatar-frame/`）を名指ししてテーマを渡すだけにし、スキルの構図・大きさ・手順は
//! 上書きしない（大きさも指定しないので、スキルの既定の納品サイズになる）。足すのは、出来上がった PNG の置き場所だけ。
//! `$<name>` をスキルの SKILL.md への参照に直すのはランナーのアダプタ（スキルを書き出した場所を知っている）。

use crate::locale;

/// 枠の生成に使う内蔵スキルの name（内蔵スキルの一覧から引く。プロンプトでは `$<name>` と呼ぶ）
pub const FRAME_SKILL_NAME: &str = "ornate-avatar-frame";

/// 依頼の本文（いまの言語）。description は利用者の言葉のまま、output は PNG を保存してもらう絶対パス
pub fn frame_prompt(description: &str, output: &str) -> String {
    let skill = format!("${FRAME_SKILL_NAME}");
    locale::pick([
        format!("{skill} でアイコンの枠を1つ生成して。テーマ: {description}\n完成した枠の PNG は {output} に保存して。"),
        format!("Use {skill} to generate one avatar frame. Theme: {description}\nSave the finished frame PNG to {output}."),
        format!("用 {skill} 生成一个头像框。主题：{description}\n完成的头像框 PNG 请保存到 {output}。"),
        format!("用 {skill} 產生一個頭像框。主題：{description}\n完成的頭像框 PNG 請儲存到 {output}。"),
        format!("{skill}(으)로 아이콘 테두리를 하나 생성해 줘. 테마: {description}\n완성한 테두리 PNG는 {output}에 저장해 줘."),
    ])
}
