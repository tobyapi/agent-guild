//! 人間のプロフィールのユースケース。名前はエージェント名と同じ規則で、重複させない。

use guild_domain::agent::ensure_unique_name;
use guild_domain::profile::{normalize_profile, Profile};

use crate::error::AppResult;
use crate::services::Ports;

#[derive(Clone)]
pub struct ProfileService {
    ports: Ports,
}

impl ProfileService {
    pub fn new(ports: Ports) -> Self {
        Self { ports }
    }

    pub fn update(&self, profile: Profile) -> AppResult<Profile> {
        let profile = normalize_profile(profile)?;
        ensure_unique_name(&profile.name, &self.ports.agents.list()?, None, None)?;
        self.ports.profile.set(&profile)?;
        self.ports.events.state_changed();
        Ok(profile)
    }
}
