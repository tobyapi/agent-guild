//! 会話の言語（docs/i18n.md）。日本語以外では、システムプロンプトの先頭近くに「この言語で書く」節を、
//! 会話プロンプトの最後に1行の念押しを入れる（どちらもその言語で書く）。システムプロンプトの本文は日本語のまま。
//! 日本語のときは何も入れない（言語の設定がなかった版とプロンプトが同じになる）。

use crate::locale::Language;

/// システムプロンプトの節（日本語なら空）
pub(super) fn section(language: Language) -> String {
    let text = match language {
        Language::Ja => return String::new(),
        Language::En => {
            "# Language
Always write in English: your replies, the progress updates you post while working, the instructions you write in tasks blocks, your answers when you are consulted, and your notes in MEMORY.md. Do this even though these instructions are written in Japanese, and even if other members or materials use another language. Keep code, identifiers, file names, @mentions, names, and markers such as [PASS] exactly as they are."
        }
        Language::ZhHans => {
            "# 语言
请始终使用简体中文书写：你的回复、工作中发布的进度更新、在 tasks 块中写的指示、被咨询时的回答，以及 MEMORY.md 中的笔记。即使这些指示是用日语写的，或者其他成员和资料使用其他语言，也请这样做。代码、标识符、文件名、@提及、名字以及 [PASS] 等标记请保持原样。"
        }
        Language::ZhHant => {
            "# 語言
請一律使用繁體中文書寫：你的回覆、工作中張貼的進度更新、在 tasks 區塊中寫的指示、被諮詢時的回答，以及 MEMORY.md 中的筆記。即使這些指示是用日文寫的，或其他成員和資料使用其他語言，也請這樣做。程式碼、識別碼、檔案名稱、@提及、名字以及 [PASS] 等標記請保持原樣。"
        }
        Language::Ko => {
            "# 언어
항상 한국어로 작성하세요. 답변, 작업 중에 올리는 진행 상황, tasks 블록에 쓰는 지시, 상담을 받았을 때의 답변, MEMORY.md의 메모 모두 마찬가지입니다. 이 지시문이 일본어로 쓰여 있더라도, 다른 멤버나 자료가 다른 언어를 쓰더라도 한국어로 쓰세요. 코드, 식별자, 파일 이름, @멘션, 이름, [PASS] 같은 표시는 그대로 두세요."
        }
    };
    format!("{text}\n")
}

/// 会話プロンプトの最後の念押し（日本語なら空）
pub(super) fn reminder(language: Language) -> &'static str {
    language.pick([
        "",
        "(Write in English. Keep code, identifiers, file names, @mentions, names, and [PASS] as they are.)",
        "（请用简体中文书写。代码、标识符、文件名、@提及、名字和 [PASS] 保持原样。）",
        "（請用繁體中文書寫。程式碼、識別碼、檔案名稱、@提及、名字和 [PASS] 保持原樣。）",
        "(한국어로 작성하세요. 코드, 식별자, 파일 이름, @멘션, 이름, [PASS]는 그대로 둡니다.)",
    ])
}
