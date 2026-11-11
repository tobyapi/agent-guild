//! ID をフォルダ名・ファイル名にするときに、データフォルダの決まった場所の外を指さないこと。

use guild_application::ports::{AttachmentStore, Workspace};
use guild_domain::attachment::Attachment;
use guild_domain::ids::{AgentId, AttachmentId, ChannelId};

use super::TempDir;
use crate::infrastructure::attachments::FsAttachments;
use crate::infrastructure::data_dir::safe_component;
use crate::infrastructure::workspace::FsWorkspace;

const HOSTILE_IDS: [&str; 6] = ["..", "../..", r"..\..\outside", "/etc", r"C:\Windows", "a/../../b"];
const UUID: &str = "c0000000-0000-4000-8000-000000000001";

#[test]
fn safe_component_keeps_uuids_and_removes_separators_and_dots() {
    assert_eq!(safe_component(UUID), UUID);
    assert_eq!(safe_component("claude_code-2"), "claude_code-2");
    assert_eq!(safe_component(".."), "__");
    assert_eq!(safe_component(r"..\..\outside"), "______outside");
    assert_eq!(safe_component(r"C:\Windows"), "C__Windows");
    assert_eq!(safe_component(""), "_");
}

#[test]
fn hostile_agent_ids_stay_inside_the_agents_folder() {
    let data = TempDir::new("agent-id");
    let workspace = FsWorkspace::new(&data.0);
    let agents = data.0.join("agents");
    assert_eq!(workspace.work_dir(&AgentId::new(UUID)), agents.join(UUID).join("work"), "UUID はそのまま");
    for id in HOSTILE_IDS {
        let work = workspace.work_dir(&AgentId::new(id));
        assert_eq!(work.parent().and_then(|dir| dir.parent()), Some(agents.as_path()), "{id}");
    }
    // 消すのは agents/ の中の1フォルダだけ（データフォルダそのものや親は消えない）
    workspace.remove(&AgentId::new("..")).unwrap();
    workspace.remove(&AgentId::new("../..")).unwrap();
    assert!(data.0.is_dir());
}

#[test]
fn hostile_channel_and_attachment_ids_stay_inside_the_attachments_folder() {
    let data = TempDir::new("attachment-id");
    let store = FsAttachments::new(&data.0);
    let attachments = data.0.join("attachments");
    assert_eq!(store.channel_dir(&ChannelId::new(UUID)), attachments.join(UUID), "UUID はそのまま");
    for id in HOSTILE_IDS {
        let attachment = Attachment {
            id: AttachmentId::new(id),
            name: "notes.txt".to_owned(),
            media_type: "text/plain".to_owned(),
            size: 1,
        };
        let channel = ChannelId::new(id);
        assert_eq!(store.channel_dir(&channel).parent(), Some(attachments.as_path()), "{id}");
        let path = store.path(&channel, &attachment);
        assert_eq!(path.parent().and_then(|dir| dir.parent()), Some(attachments.as_path()), "{id}");
        assert!(path.extension().is_some_and(|extension| extension == "txt"), "{id}");
    }
    store.delete_channel(&ChannelId::new("..")).unwrap();
    assert!(data.0.is_dir());
}
