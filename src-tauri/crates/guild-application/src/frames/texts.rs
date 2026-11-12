//! 枠のユースケースの文面（いまの言語）。

use guild_domain::locale;

pub(super) fn frame_subject() -> &'static str {
    locale::pick(["アイコンの枠", "Avatar frame", "头像框", "頭像框", "아이콘 테두리"])
}

pub(super) fn frame_image_subject() -> &'static str {
    locale::pick(["アイコンの枠の画像", "Avatar frame image", "头像框图像", "頭像框圖像", "아이콘 테두리 이미지"])
}

pub(super) fn cannot_draw() -> &'static str {
    locale::pick([
        "このバックエンドではアイコンの枠を生成できません。枠を生成できるバックエンドを選んでください",
        "This backend can't generate avatar frames. Choose a backend that can.",
        "该后端无法生成头像框。请选择可以生成头像框的后端。",
        "該後端無法產生頭像框。請選擇可以產生頭像框的後端。",
        "이 백엔드로는 아이콘 테두리를 생성할 수 없습니다. 테두리를 생성할 수 있는 백엔드를 선택하십시오.",
    ])
}

pub(super) fn not_ready() -> &'static str {
    locale::pick([
        "このバックエンドはいま使える状態ではありません。設定のバックエンドで接続を確かめてください",
        "This backend isn't ready. Check its connection under Backends in Settings.",
        "该后端当前不可用。请在设置的后端中检查连接。",
        "該後端目前無法使用。請在設定的後端中檢查連線。",
        "이 백엔드는 지금 사용할 수 없습니다. 설정의 백엔드에서 연결을 확인하십시오.",
    ])
}

pub(super) fn unusable(reason: &str) -> String {
    locale::pick([
        format!("描かれた枠を使えませんでした（{reason}）。もう一度生成してください"),
        format!("The generated frame couldn't be used ({reason}). Please generate again."),
        format!("生成的头像框无法使用（{reason}）。请重新生成。"),
        format!("生成的頭像框無法使用（{reason}）。請重新產生。"),
        format!("생성된 테두리를 사용할 수 없습니다({reason}). 다시 생성하십시오."),
    ])
}

pub(super) fn cancelled() -> String {
    locale::pick([
        "枠の生成を取り消しました",
        "Frame generation was cancelled",
        "已取消生成头像框",
        "已取消產生頭像框",
        "테두리 생성을 취소했습니다",
    ])
    .to_owned()
}

pub(super) fn timed_out() -> String {
    locale::pick([
        "時間内に枠が返ってこなかったため、生成をやめました",
        "Generation stopped because no frame came back in time",
        "未能在时限内返回头像框，已停止生成",
        "未能在時限內傳回頭像框，已停止產生",
        "제한 시간 안에 테두리가 오지 않아 생성을 중단했습니다",
    ])
    .to_owned()
}
