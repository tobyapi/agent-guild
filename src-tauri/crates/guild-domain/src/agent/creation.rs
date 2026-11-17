use super::{creatable_template, AgentInput, AUTONOMY_INTERVAL_MIN};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct CreationRequest {
    pub request_id: String,
    pub name: String,
    pub template: String,
    pub backend: String,
    #[serde(default)]
    pub model: String,
    #[serde(default)]
    pub personality: String,
    #[serde(default)]
    pub tone: String,
    #[serde(default)]
    pub expertise: String,
}

impl CreationRequest {
    pub fn input(self) -> Result<AgentInput, &'static str> {
        if self.request_id.is_empty()
            || self.request_id.len() > 80
            || !self.request_id.bytes().all(|c| c.is_ascii_alphanumeric() || b"-_.".contains(&c))
        {
            return Err("invalid_request_id");
        }
        let defaults = creatable_template(&self.template).ok_or("invalid_template")?.defaults;
        Ok(AgentInput {
            name: self.name,
            avatar: "\u{1f642}".into(),
            color: "#cb9d2a".into(),
            frame: String::new(),
            tags: defaults.tags,
            role: defaults.role,
            personality: self.personality,
            tone: self.tone,
            voice: Default::default(),
            expertise: self.expertise,
            backend: self.backend,
            model: self.model,
            backend_options: Default::default(),
            permissions: defaults.permissions,
            unmentioned: defaults.unmentioned,
            consultable: defaults.consultable,
            can_delegate: defaults.can_delegate,
            autonomy_enabled: false,
            autonomy_interval_min: AUTONOMY_INTERVAL_MIN,
            autonomy_channel_id: None,
        })
    }
}

pub fn extract(raw: &str) -> Option<(&str, &str)> {
    let raw = raw.trim_end();
    let (head, close) = raw.rsplit_once('\n')?;
    if close.trim_end_matches('\r') != "```" {
        return None;
    }
    let (head, json) = head.rsplit_once('\n')?;
    let (text, open) = head.rsplit_once('\n')?;
    if open.trim_end_matches('\r') != "```create-agent"
        || text.lines().any(|line| line.trim_start().starts_with(['>', '<']))
        || text.trim().is_empty()
        || text.trim() == "[PASS]"
        || !text.ends_with(['\n', '\r'])
    {
        return None;
    }
    let mut fence = None;
    for line in text.lines() {
        let line = line.trim_start_matches(' ');
        let Some(marker) = line.chars().next().filter(|c| matches!(c, '`' | '~')) else { continue };
        let size = line.chars().take_while(|c| *c == marker).count();
        if size < 3 {
            continue;
        }
        match fence {
            None if line == "```create-agent" => return None,
            None => fence = Some((marker, size)),
            Some((m, n)) if m == marker && size >= n && line[size..].trim().is_empty() => fence = None,
            _ => {}
        }
    }
    if fence.is_some() {
        return None;
    }
    Some((text.trim_end(), json.trim_end_matches('\r')))
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn creation_extracts_only_one_explicit_trailing_request() {
        let request = "Ready.\n\n```create-agent\n{}\n```";
        assert_eq!(extract(request), Some(("Ready.", "{}")));
        for raw in [request.replace('\n', "\r\n"), request.to_owned()] {
            assert!(extract(&raw).is_some());
        }
        for raw in [
            format!("````text\n{request}\n````"),
            format!("> {request}"),
            format!("```text\n{request}"),
            format!("{request}\n\n{request}"),
            request.replace("Ready.", "[PASS]"),
            request.replace("Ready.\n\n", ""),
            request.replace("\n\n", "\n"),
            request.replace("```create-agent", " ```create-agent"),
        ] {
            assert!(extract(&raw).is_none(), "{raw}");
        }
    }
    #[test]
    fn creation_rejects_claims_unknown_fields_and_manager_targets() {
        let valid = r#"{"requestId":"task-1","name":"New","template":"worker","backend":"local"}"#;
        let request: CreationRequest = serde_json::from_str(valid).unwrap();
        assert!(!request.input().unwrap().autonomy_enabled);
        for field in [
            "actorId",
            "principalId",
            "agentId",
            "createdBy",
            "role",
            "permissions",
            "path",
            "command",
            "backendOptions",
            "extra",
        ] {
            let raw = valid.replace("\"name\":", &format!("\"{field}\":\"manager\",\"name\":"));
            assert!(serde_json::from_str::<CreationRequest>(&raw).is_err(), "{field}");
        }
        for template in ["manager", "Manager", "unknown", ""] {
            let raw = valid.replace("worker", template);
            assert!(serde_json::from_str::<CreationRequest>(&raw).unwrap().input().is_err());
        }
        for key in ["", "bad key", "../escape", ""] {
            let mut req: CreationRequest = serde_json::from_str(valid).unwrap();
            req.request_id = key.into();
            assert!(req.input().is_err());
        }
        assert!(serde_json::from_str::<CreationRequest>(&valid.replace("\"name\":", "\"name\":\"Other\",\"name\":"))
            .is_err());
    }
    #[test]
    fn creation_requires_the_official_first_role_tag() {
        for template in super::super::templates() {
            for tag in &template.role_tags {
                assert_eq!(
                    super::super::role_can_create_agents(std::slice::from_ref(tag)),
                    super::super::creatable_template(&template.id).is_none()
                );
            }
        }
        for tags in [vec![], vec!["unknown".into()], vec!["worker".into(), "Manager".into()]] {
            assert!(!super::super::role_can_create_agents(&tags));
        }
    }
}
