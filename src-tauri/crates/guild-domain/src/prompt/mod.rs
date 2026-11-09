//! システムプロンプトと会話プロンプトの組み立て（design.md §8。文面の原案は .old/server/prompts.ts）。
//! I/O はしない: 現在日時の文字列・MEMORY.md の内容・スキル・実効権限・時刻の表示方法は引数で受け取る。
//! 節はエージェントの振る舞いの設定（Agent::behavior）と実効権限から組み立てる（種別やタグで分岐しない）。

mod answering;
mod attachments;
mod capabilities;
mod consult;
mod conversation;
mod delegating;
mod intent;
mod members;
mod memory;
mod modes;
mod persona;
mod report;
mod rules;
mod safeguards;
mod skills;

pub use conversation::{
    build_conversation_prompt, ConsultSource, HISTORY_LIMIT, MESSAGE_CHAR_LIMIT, RECENT_CHANNEL_LIMIT,
    TRIGGER_CHAR_LIMIT,
};
pub use intent::{build_intent, INTENT_CHAR_LIMIT, INTENT_MESSAGE_LIMIT};

use crate::agent::{Agent, Permissions};
use crate::attachment::Attachment;
use crate::backend::BackendInfo;
use crate::channel::Channel;
use crate::delegation::Delegation;
use crate::message::Message;
use crate::profile::Profile;
use crate::skill::Skill;

/// プロンプトの材料
#[derive(Clone, Copy)]
pub struct PromptContext<'a> {
    /// 実行するエージェント
    pub agent: &'a Agent,
    /// 実効権限（本人の権限とバックエンドの能力から計算したもの）
    pub permissions: Permissions,
    pub channel: &'a Channel,
    /// 全エージェント（削除済みを含んでよい。メンバー・相談相手・発言者の表示に使う）
    pub agents: &'a [Agent],
    /// バックエンドの情報（メンバーの実効権限の要約に使う。分からなければ空）
    pub backends: &'a [BackendInfo],
    /// 人間のプロフィール
    pub me: &'a Profile,
    /// このエージェントのスキル
    pub skills: &'a [Skill],
    /// MEMORY.md の内容（読まなかった・なければ空）
    pub memory: &'a str,
    /// 現在日時の表示（例: "2026年11月8日(日) 15:30"）
    pub now_label: &'a str,
    /// 発言時刻（createdAt のミリ秒）の表示
    pub time_label: &'a dyn Fn(i64) -> String,
    /// 発言に添えられたファイルの絶対パス（エージェントに読んでもらうために伝える）
    pub attachment_path: &'a dyn Fn(&Message, &Attachment) -> String,
    /// このジョブの割り振り（task・report のジョブと、担当者の相談の連鎖。ほかは None）
    pub delegation: Option<&'a Delegation>,
}

/// システムプロンプト: 人格 → 仕事 → 相談・レビューへの答え方 → 割り振りのしかた → 相談のしかた → スキル →
/// 作業場所とメモ → 外の資料の扱いと操作の前の確認 → 場所と共通ルール
pub fn build_system_prompt(ctx: &PromptContext<'_>) -> String {
    let sections = [
        persona::section(ctx.agent),
        answering::work_section(ctx),
        answering::consultee_section(ctx),
        delegating::section(ctx),
        consult::section(ctx),
        skills::section(ctx.skills, &ctx.permissions),
        memory::section(ctx),
        safeguards::section(ctx),
        rules::section(ctx),
    ];
    sections
        .into_iter()
        .filter(|section| !section.is_empty())
        .collect::<Vec<_>>()
        .join("\n")
}
