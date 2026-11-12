//! macOS のセットアップ（CLI のインストール・アプリを開く）の失敗の文面（いまの言語）。

use guild_domain::locale;

pub(super) fn no_home() -> String {
    locale::pick([
        "ホームフォルダが見つかりませんでした。",
        "Could not find your home folder.",
        "找不到主文件夹。",
        "找不到家目錄。",
        "홈 폴더를 찾을 수 없습니다.",
    ])
    .to_owned()
}

pub(super) fn bad_install_dir() -> String {
    locale::pick([
        "インストール先のフォルダを使えませんでした。",
        "Could not use the install folder.",
        "无法使用安装文件夹。",
        "無法使用安裝資料夾。",
        "설치 폴더를 사용할 수 없습니다.",
    ])
    .to_owned()
}

pub(super) fn bad_target() -> String {
    locale::pick([
        "セットアップの対象が不正です",
        "The setup target is invalid",
        "设置对象无效",
        "設定對象無效",
        "설정 대상이 올바르지 않습니다",
    ])
    .to_owned()
}

pub(super) fn install_failed(label: &str) -> String {
    locale::pick([
        format!("{label} をインストールできませんでした。接続と空き容量を確認して、もう一度お試しください。"),
        format!("Could not install {label}. Check your connection and free space, then try again."),
        format!("无法安装 {label}。请检查网络连接和可用空间后重试。"),
        format!("無法安裝 {label}。請檢查網路連線和可用空間後再試一次。"),
        format!("{label}을(를) 설치할 수 없습니다. 연결과 여유 공간을 확인한 뒤 다시 시도하세요."),
    ])
}

pub(super) fn install_timed_out(label: &str) -> String {
    locale::pick([
        format!("{label} のセットアップが時間切れになりました。もう一度お試しください。"),
        format!("Setting up {label} took too long. Please try again."),
        format!("{label} 的设置超时。请重试。"),
        format!("{label} 的設定逾時。請再試一次。"),
        format!("{label} 설정 시간이 초과되었습니다. 다시 시도하세요."),
    ])
}

pub(super) fn download_failed(label: &str) -> String {
    locale::pick([
        format!(
            "{label} のインストーラーを取得できませんでした。インターネット接続を確認して、もう一度お試しください。"
        ),
        format!("Could not download the {label} installer. Check your internet connection, then try again."),
        format!("无法获取 {label} 的安装程序。请检查网络连接后重试。"),
        format!("無法取得 {label} 的安裝程式。請檢查網路連線後再試一次。"),
        format!("{label} 설치 프로그램을 받을 수 없습니다. 인터넷 연결을 확인한 뒤 다시 시도하세요."),
    ])
}

pub(super) fn bad_app(label: &str) -> String {
    locale::pick([
        format!("{label} を開けませんでした。起動するアプリの指定が不正です。"),
        format!("Could not open {label}. The app to launch is not specified correctly."),
        format!("无法打开 {label}。要启动的应用指定无效。"),
        format!("無法開啟 {label}。要啟動的應用程式指定無效。"),
        format!("{label}을(를) 열 수 없습니다. 실행할 앱 지정이 올바르지 않습니다."),
    ])
}

pub(super) fn app_not_installed(label: &str) -> String {
    locale::pick([
        format!("{label} を開けませんでした。「アプリケーション」に {label} が入っているか確認してください。"),
        format!("Could not open {label}. Check that {label} is in your Applications folder."),
        format!("无法打开 {label}。请确认“应用程序”中已安装 {label}。"),
        format!("無法開啟 {label}。請確認「應用程式」中已安裝 {label}。"),
        format!("{label}을(를) 열 수 없습니다. '응용 프로그램'에 {label}이(가) 있는지 확인하세요."),
    ])
}

pub(super) fn open_manually(label: &str) -> String {
    locale::pick([
        format!("{label} を開けませんでした。{label} のアプリを開いて「再確認」を押してください。"),
        format!("Could not open {label}. Open the {label} app, then click Recheck."),
        format!("无法打开 {label}。请打开 {label} 应用，然后点击“重新检查”。"),
        format!("無法開啟 {label}。請開啟 {label} 應用程式，然後按「重新檢查」。"),
        format!("{label}을(를) 열 수 없습니다. {label} 앱을 연 뒤 '다시 확인'을 누르세요."),
    ])
}
