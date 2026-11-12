//! バックエンドのセットアップで使用者に見せる文面（いまの言語。docs/i18n.md）。label はバックエンドの表示名。

use guild_domain::locale;

pub(super) fn cannot_start(label: &str) -> String {
    locale::pick([
        format!("{label} はアプリから起動できません"),
        format!("{label} cannot be started from the app"),
        format!("无法从应用启动 {label}"),
        format!("無法從應用程式啟動 {label}"),
        format!("{label}은(는) 앱에서 시작할 수 없습니다"),
    ])
}

pub(super) fn start_unconfirmed(label: &str) -> String {
    locale::pick([
        format!("{label} の起動を確認できませんでした。{label} の画面を確認して「再確認」を押してください。"),
        format!("Could not confirm that {label} started. Check the {label} window and press “Recheck”."),
        format!("无法确认 {label} 已启动。请查看 {label} 的界面，然后点击“重新检查”。"),
        format!("無法確認 {label} 已啟動。請查看 {label} 的畫面，然後按下「重新檢查」。"),
        format!("{label}의 시작을 확인할 수 없습니다. {label} 화면을 확인하고 \"다시 확인\"을 누르십시오."),
    ])
}

pub(super) fn install_unconfirmed(cli: &str) -> String {
    locale::pick([
        format!("インストールした {cli} を確認できませんでした。再確認をお試しください。"),
        format!("Could not find the installed {cli}. Try rechecking."),
        format!("无法确认已安装的 {cli}。请尝试重新检查。"),
        format!("無法確認已安裝的 {cli}。請嘗試重新檢查。"),
        format!("설치한 {cli}을(를) 확인할 수 없습니다. 다시 확인해 보십시오."),
    ])
}

pub(super) fn cannot_login(label: &str) -> String {
    locale::pick([
        format!("{label} はアプリからログインできません"),
        format!("{label} cannot be signed in to from the app"),
        format!("无法从应用登录 {label}"),
        format!("無法從應用程式登入 {label}"),
        format!("{label}은(는) 앱에서 로그인할 수 없습니다"),
    ])
}
