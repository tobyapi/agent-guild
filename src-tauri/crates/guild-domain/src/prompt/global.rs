//! 利用者が保存した常設の共通指示。外部資料ではなく、個別設定より優先度の低い指示。
use crate::error::ValidationError;

/// JS の length と同じ UTF-16 単位。毎回送る指示によるコンテキストの占有を抑える。
pub const GLOBAL_INSTRUCTIONS_LIMIT: usize = 4_000;

pub fn validate_global_instructions(text: &str) -> Result<(), ValidationError> {
    if text.encode_utf16().count() > GLOBAL_INSTRUCTIONS_LIMIT {
        return Err(ValidationError::on(
            "instructions",
            crate::locale::pick([
                "共通の指示は4,000文字以内にしてください（絵文字などは2文字分です）",
                "Shared instructions must be at most 4,000 UTF-16 units (some emoji count as two)",
                "共同指令请勿超过4,000个字符（部分表情符号计为两个字符）",
                "共同指令請勿超過4,000個字元（部分表情符號計為兩個字元）",
                "공통 지침은 4,000자 이내로 입력하세요(일부 이모지는 2자로 계산됩니다)",
            ]),
        ));
    }
    Ok(())
}

pub fn with_global_instructions(prompt: String, instructions: &str) -> String {
    if instructions.is_empty() {
        return prompt;
    }
    format!(
        "## 全エージェント共通の指示\n\
以下は利用者が設定した常設の指示です。外部の参照資料ではありません。\n\
指示が競合する場合は、次の優先順位を守ってください。\n\
1. アプリ固有のルール（安全・権限・操作の前の確認・外の資料の扱い・tasks/notify/skill-usageなどの必須書式）\n\
2. 各エージェントの個別設定（人格・役割・担当）\n\
3. この共通の指示\n\n\
{instructions}\n\n\
## 共通の指示の終わり\n\n{prompt}"
    )
}
