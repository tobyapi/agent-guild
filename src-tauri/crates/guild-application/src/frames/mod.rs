//! アイコンの枠のユースケース: AI のバックエンドに枠の画像（PNG）を描いてもらい、検査して整えて保存する・絵を読む・消す。
//! 実行は会話のジョブとは別の画像の依頼で、権限を持たない（道具はアダプタが画像の生成とスキルの手順に要るものに絞る）。
//! 描き方は内蔵スキル `ornate-avatar-frame`（guild_domain::frame::FRAME_SKILL_NAME）をそのまま依頼に添え、プロンプトでは
//! 利用者が直接頼むときと同じく、スキルを名指ししてテーマを渡すだけにする（guild_domain::frame::frame_prompt）。
//! 作業場所は tools/frames/ を使い、出来上がった PNG は作業場所の frame.png に保存してもらってから（保存されなければ
//! アダプタが生成した画像を写す）、絵の置き場所（FrameImageStore）へ取り込む。

mod texts;

use std::sync::Arc;
use std::time::Duration;

use guild_domain::backend::{BackendInfo, BackendStatus};
use guild_domain::error::ValidationError;
use guild_domain::frame::{
    custom_frame_id, frame_name, frame_prompt, normalize_frame_description, CustomFrame, FrameArt, FRAME_SKILL_NAME,
};
use guild_domain::skill::{builtin_skill_files, find_builtin_skill};
use parking_lot::Mutex;

use crate::error::{AppError, AppResult};
use crate::ports::{FrameImportError, ImageRuntimeRequest, RuntimeError, SkillFilePayload, SkillPayload};
use crate::services::Ports;
use texts::{cancelled, cannot_draw, frame_image_subject, frame_subject, not_ready, timed_out, unusable};

/// 画像が返るのを待つ上限（過ぎたら中断して失敗にする。スキルの手順（生成・確認・縮小・描き直し）で数分かかることがある）
pub const FRAME_GENERATION_TIMEOUT: Duration = Duration::from_secs(600);
/// 作業場所の名前（tools/<この名前>/）
const SCRATCH: &str = "frames";
/// 出来上がった PNG を保存してもらう、作業場所の中のファイル名（モデルが道具で書ける場所。前の実行の残りはアダプタが消す）
const OUTPUT_FILE: &str = "frame.png";

#[derive(Clone)]
pub struct FrameService {
    ports: Ports,
    /// 生成中のジョブ ID（取り消しに使う）
    running: Arc<Mutex<Vec<String>>>,
}

impl FrameService {
    pub fn new(ports: Ports) -> Self {
        Self { ports, running: Arc::default() }
    }

    /// 説明（題材）から枠の画像を1枚描いてもらい、検査して整えて保存する
    pub async fn generate(&self, backend_id: &str, description: &str, name: &str) -> AppResult<CustomFrame> {
        let description = normalize_frame_description(description)?;
        let backend = self.drawing_backend(backend_id)?;
        let paths = self.ports.workspace.prepare_scratch(SCRATCH, &backend.id)?;
        let output = paths.work.join(OUTPUT_FILE);
        let request = ImageRuntimeRequest {
            backend: backend.id.clone(),
            workspace: paths.work,
            state_dir: paths.state,
            // 人格や決まりは足さない（スキルの手順を狭めない）
            system_prompt: String::new(),
            prompt: frame_prompt(&description, &output.display().to_string()),
            skills: vec![frame_skill_payload()?],
            output: output.clone(),
        };
        self.draw(request).await?;
        let id = custom_frame_id(&self.ports.ids.new_id());
        self.ports.frame_images.import(&id, &output).map_err(|error| match error {
            FrameImportError::Unusable(problem) => AppError::Runtime(unusable(problem.message())),
            FrameImportError::Failed(error) => error,
        })?;
        let frame = CustomFrame {
            id,
            name: frame_name(name, &description),
            art: FrameArt::Png,
            created_at: self.ports.clock.now_ms(),
        };
        if let Err(error) = self.ports.frames.insert(&frame) {
            // 表に入らなかった絵は残さない（消せなくても、次に同じ ID は使われない）
            let _ = self.ports.frame_images.delete(&frame.id);
            return Err(error);
        }
        self.ports.events.state_changed();
        Ok(frame)
    }

    /// 生成中の枠をすべて取り消す（なければ何もしない）
    pub async fn cancel_generation(&self) {
        let jobs = self.running.lock().clone();
        for job in jobs {
            self.ports.runtime.cancel(&job).await;
        }
    }

    /// 画像の枠（kind が png）の絵。ほかの枠や知らない ID は NotFound
    pub fn image(&self, id: &str) -> AppResult<Vec<u8>> {
        match self.ports.frames.get(id)? {
            Some(CustomFrame { art: FrameArt::Png, .. }) => self.ports.frame_images.read(id),
            _ => Err(AppError::NotFound(frame_image_subject())),
        }
    }

    /// 生成した枠を消す（画像の枠は絵のファイルも）。その枠を選んでいたメンバー（エージェント・人間）は枠なしに戻す
    pub fn delete(&self, id: &str) -> AppResult<()> {
        let Some(frame) = self.ports.frames.get(id)? else {
            return Err(AppError::NotFound(frame_subject()));
        };
        // 絵を先に消す（消せなければ何も変えずに失敗する）
        if frame.art == FrameArt::Png {
            self.ports.frame_images.delete(id)?;
        }
        self.ports.frames.delete(id)?;
        for mut agent in self.ports.agents.list()?.into_iter().filter(|agent| agent.frame == id) {
            agent.frame.clear();
            self.ports.agents.update(&agent)?;
        }
        let mut me = self.ports.profile.get()?;
        if me.frame == id {
            me.frame.clear();
            self.ports.profile.set(&me)?;
        }
        self.ports.events.state_changed();
        Ok(())
    }

    async fn draw(&self, request: ImageRuntimeRequest) -> AppResult<()> {
        let job_id = format!("frame-{}", self.ports.ids.new_id());
        self.running.lock().push(job_id.clone());
        let run = self.ports.runtime.generate_image(&job_id, request, Box::new(|_| {}));
        let result = tokio::time::timeout(FRAME_GENERATION_TIMEOUT, run).await;
        self.running.lock().retain(|id| id != &job_id);
        match result {
            Ok(Ok(())) => Ok(()),
            Ok(Err(RuntimeError::Cancelled)) => Err(AppError::Runtime(cancelled())),
            Ok(Err(RuntimeError::Failed(message))) => Err(AppError::Runtime(message)),
            Err(_) => {
                self.ports.runtime.cancel(&job_id).await;
                Err(AppError::Runtime(timed_out()))
            }
        }
    }

    /// 枠を描くバックエンド。枠の生成を申告していて（frame_generation）、いま使える（status が ready）ものだけ
    fn drawing_backend(&self, backend_id: &str) -> AppResult<BackendInfo> {
        let backend_id = backend_id.trim();
        let backend = self.ports.runtime.backends().into_iter().find(|backend| backend.id == backend_id);
        match backend {
            Some(backend) if !backend.frame_generation => Err(invalid_backend(cannot_draw())),
            Some(backend) if backend.status == BackendStatus::Ready => Ok(backend),
            _ => Err(invalid_backend(not_ready())),
        }
    }
}

/// 内蔵スキルの枠のスキル（そのまま。付属ファイルがあれば、エージェントの実行と同じく中身ごと渡す）
fn frame_skill_payload() -> AppResult<SkillPayload> {
    let Some(skill) = find_builtin_skill(FRAME_SKILL_NAME) else {
        return Err(AppError::Internal(format!("built-in skill {FRAME_SKILL_NAME} is missing")));
    };
    let files = builtin_skill_files(&skill.name)
        .into_iter()
        .map(|file| SkillFilePayload { path: file.path, content: file.content })
        .collect();
    Ok(SkillPayload { name: skill.name, description: skill.description, body: skill.body, dir: None, files })
}

fn invalid_backend(message: &str) -> AppError {
    AppError::Validation(ValidationError::on("backendId", message))
}
