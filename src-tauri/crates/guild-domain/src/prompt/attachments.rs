//! 会話プロンプトの添付の節: 発言の見出しに添える枚数と、添えた画像・読めるファイルの一覧。
//! 画像そのものはランナーが SDK の入力として渡し、ファイルはここでパスを伝える。

use super::members::display_name;
use super::PromptContext;
use crate::attachment::Attachment;
use crate::message::Message;

/// 添付のある発言の見出しに添える（例: 「（画像 2 枚・ファイル 1 個）」）
pub(super) fn note(message: &Message) -> String {
    let images = message.attachments.iter().filter(|attachment| attachment.is_image()).count();
    let files = message.attachments.len() - images;
    let parts: Vec<String> = [(images, "画像", "枚"), (files, "ファイル", "個")]
        .into_iter()
        .filter(|(count, _, _)| *count > 0)
        .map(|(count, label, unit)| format!("{label} {count} {unit}"))
        .collect();
    if parts.is_empty() {
        String::new()
    } else {
        format!("（{}）", parts.join("・"))
    }
}

/// 添えた画像がどの発言のものか（添えた順）
pub(super) fn images_section(ctx: &PromptContext<'_>, messages: &[&Message]) -> String {
    let lines: Vec<String> = messages
        .iter()
        .map(|message| {
            let count = message.attachments.iter().filter(|attachment| attachment.is_image()).count();
            format!("- {} の発言: {count} 枚", speaker(ctx, message))
        })
        .collect();
    format!(
        "# 添付画像\nこの依頼には、次の発言に貼られた画像を添えています（添えた順）。画像の内容も踏まえて応えてください。\n{}\n\n",
        lines.join("\n")
    )
}

/// 読めるファイルの一覧（パスつき）。読む権限がなければ、そう伝える
pub(super) fn files_section(ctx: &PromptContext<'_>, files: &[(&Message, &Attachment)]) -> String {
    let lines: Vec<String> = files
        .iter()
        .map(|(message, attachment)| {
            let path = (ctx.attachment_path)(message, attachment);
            format!("- {} の発言: {}（{}）\n  {path}", speaker(ctx, message), attachment.name, size_label(attachment.size))
        })
        .collect();
    let how = if ctx.permissions.read_files {
        "内容が必要なら、このパスから読んでください（読み取りのみ）。"
    } else {
        "あなたにはファイルを読む権限がないため、内容は読めません。必要なら人間に内容を聞いてください。"
    };
    format!("# 添付ファイル\n次の発言にファイルが添えられています。{how}\n{}\n\n", lines.join("\n"))
}

fn speaker(ctx: &PromptContext<'_>, message: &Message) -> String {
    format!("[{}] {}", (ctx.time_label)(message.created_at), display_name(&message.author_id, ctx))
}

/// 大きさの表示（例: 「820 B」「12.5 KB」「3.2 MB」）
fn size_label(size: u64) -> String {
    const KB: u64 = 1024;
    match size {
        0..KB => format!("{size} B"),
        _ if size < KB * KB => format!("{:.1} KB", size as f64 / KB as f64),
        _ => format!("{:.1} MB", size as f64 / (KB * KB) as f64),
    }
}
