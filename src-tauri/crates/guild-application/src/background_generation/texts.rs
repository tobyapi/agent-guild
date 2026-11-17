use guild_domain::locale;

pub fn description() -> &'static str {
    locale::pick([
        "背景の題材を1〜200文字で入力してください",
        "Describe the background in 1–200 characters.",
        "请用1至200个字符描述背景。",
        "請用1至200個字元描述背景。",
        "배경을 1~200자로 설명해 주세요.",
    ])
}

pub fn backend() -> &'static str {
    locale::pick([
        "画像を生成できる使用可能なバックエンドを選んでください",
        "Choose a ready backend that can generate images.",
        "请选择可用且支持图像生成的后端。",
        "請選擇可用且支援圖像生成的後端。",
        "이미지를 생성할 수 있는 준비된 백엔드를 선택해 주세요.",
    ])
}

pub fn busy() -> &'static str {
    locale::pick([
        "背景を生成中です",
        "A background is already being generated.",
        "正在生成背景。",
        "正在產生背景。",
        "배경을 생성 중입니다.",
    ])
}

pub fn cancelled() -> &'static str {
    locale::pick([
        "背景の生成を取り消しました",
        "Background generation cancelled.",
        "已取消背景生成。",
        "已取消背景產生。",
        "배경 생성을 취소했습니다.",
    ])
}

pub fn timeout() -> &'static str {
    locale::pick([
        "背景の生成が時間切れになりました。もう一度お試しください",
        "Background generation timed out. Please try again.",
        "背景生成超时，请重试。",
        "背景產生逾時，請重試。",
        "배경 생성 시간이 초과되었습니다. 다시 시도해 주세요.",
    ])
}

pub fn failed() -> &'static str {
    locale::pick([
        "背景の生成に失敗しました。もう一度お試しください",
        "Background generation failed. Please try again.",
        "背景生成失败，请重试。",
        "背景產生失敗，請重試。",
        "배경 생성에 실패했습니다. 다시 시도해 주세요.",
    ])
}
