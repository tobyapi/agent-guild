//! 確定・保存できた最終返答だけが通知を要求できる。通知失敗は会話に伝播しない。
use crate::conversation::posting::{self, Origin};
use crate::{notifications::NotificationOutcome, services::Ports};
use guild_domain::{agent::Agent, locale, message::Message};

pub(super) fn submit(ports: &Ports, agent: &Agent, message: &Message, body: &str) {
    let name: String = agent.name.chars().filter(|character| !character.is_control()).collect();
    let title = format!("AI Guild · {name}");
    let notice = match ports.notifications.submit_once(message.id.as_str(), &title, body) {
        Ok(NotificationOutcome::Duplicate) => return,
        Ok(NotificationOutcome::Submitted) => locale::pick([
            "デスクトップ通知をOSへ送信しました。表示されたかは確認できません。",
            "Desktop notification submitted to the OS. Display could not be confirmed.",
            "桌面通知已提交给系统。无法确认是否显示。",
            "桌面通知已提交給系統。無法確認是否顯示。",
            "데스크톱 알림을 OS에 전달했습니다. 표시 여부는 확인할 수 없습니다.",
        ]),
        Ok(NotificationOutcome::Disabled) => locale::pick([
            "デスクトップ通知は設定で無効になっています。",
            "Desktop notifications are disabled in settings.",
            "桌面通知已在设置中禁用。",
            "桌面通知已在設定中停用。",
            "설정에서 데스크톱 알림이 꺼져 있습니다.",
        ]),
        Err(error) => {
            log::warn!("Desktop notification failed for {}: {error}", message.id);
            locale::pick([
                "デスクトップ通知を送信できませんでした。会話は続行します。",
                "Could not submit the desktop notification. The conversation will continue.",
                "无法提交桌面通知。对话将继续。",
                "無法提交桌面通知。對話將繼續。",
                "데스크톱 알림을 전달하지 못했습니다. 대화는 계속됩니다.",
            ])
        }
    };
    if let Err(error) = posting::post_notice(ports, &Origin::of(message), notice) {
        log::warn!("Could not save desktop notification status: {error}");
    }
}
