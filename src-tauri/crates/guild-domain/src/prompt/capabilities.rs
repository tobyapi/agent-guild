//! 実効権限から「できること」の文面と、メンバー一覧に載せる要約を作る。

use crate::agent::Permissions;

/// 例: 「Web検索・Webページの閲覧・作業場所でのファイルの読み書き・スキルの利用ができます。」
pub(super) fn describe(permissions: &Permissions) -> String {
    let mut abilities = Vec::new();
    if permissions.web_search {
        abilities.push("Web検索");
    }
    if permissions.web_fetch {
        abilities.push("Webページの閲覧");
    }
    if permissions.write_files && permissions.write_anywhere {
        abilities.push("作業場所の外も含めたファイルの読み書き");
    } else if permissions.read_files && permissions.read_anywhere && permissions.write_files {
        abilities.push("作業場所の外も含めたファイルの読み取りと作業場所でのファイル作成・編集");
    } else if permissions.write_files {
        abilities.push("作業場所でのファイルの読み書き");
    } else if permissions.read_files && permissions.read_anywhere {
        abilities.push("作業場所の外も含めたファイルの読み取り");
    } else if permissions.read_files {
        abilities.push("ファイルの読み取り");
    }
    if permissions.run_commands {
        abilities.push("コマンドの実行");
    }
    if permissions.skills {
        abilities.push("スキルの利用");
    }
    let mut text = if abilities.is_empty() {
        "ツールは使えないので、会話だけで答えます。".to_owned()
    } else {
        format!("{}ができます。", abilities.join("・"))
    };
    if !permissions.write_files {
        text.push_str("ファイルの作成・編集はできません。");
    }
    text
}

/// メンバー一覧に載せる要約（例: 「Web 検索・ファイル作成」）
pub(super) fn summary(permissions: &Permissions) -> String {
    let abilities: Vec<&str> = [
        (permissions.web_search, "Web 検索"),
        (permissions.web_fetch, "Web 閲覧"),
        (permissions.write_files && !permissions.write_anywhere, "ファイル作成"),
        (permissions.write_files && permissions.write_anywhere, "ファイル作成（PC 全体）"),
        (permissions.read_files && permissions.read_anywhere, "ファイル読み取り（PC 全体）"),
        (permissions.read_files && !permissions.read_anywhere && !permissions.write_files, "ファイルの読み取り"),
        (permissions.run_commands, "コマンド実行"),
        (permissions.skills, "スキル"),
    ]
    .into_iter()
    .filter_map(|(allowed, label)| allowed.then_some(label))
    .collect();
    if abilities.is_empty() {
        "会話のみ".to_owned()
    } else {
        abilities.join("・")
    }
}
