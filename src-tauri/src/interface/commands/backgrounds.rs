//! Background library commands. Input is raw base64, like message attachments.
use super::{reject, CommandResult};
use crate::interface::state::AppState;
use base64::engine::general_purpose::STANDARD;
use base64::Engine;
use guild_application::backgrounds::BackgroundService;
use guild_application::AppError;
use tauri::State;

pub struct MascotLibrary(pub BackgroundService);

#[tauri::command]
pub async fn generate_mascot_image(
    state: State<'_, AppState>,
    store: State<'_, MascotLibrary>,
    request_id: String,
    backend_id: String,
    description: String,
) -> CommandResult<String> {
    let generator = state.services()?.background_generation.clone();
    generator.generate_mascot(&store.0, &request_id, &backend_id, &description).await.map_err(reject)
}

#[tauri::command]
pub async fn list_mascot_images(
    state: State<'_, AppState>,
    store: State<'_, MascotLibrary>,
) -> CommandResult<Vec<String>> {
    state.services()?;
    store.0.list().map_err(reject)
}

#[tauri::command]
pub async fn get_mascot_image(
    state: State<'_, AppState>,
    store: State<'_, MascotLibrary>,
    id: String,
) -> CommandResult<String> {
    state.services()?;
    read_image(&store.0, &id)
}

#[tauri::command]
pub async fn delete_mascot_image(
    state: State<'_, AppState>,
    store: State<'_, MascotLibrary>,
    id: String,
) -> CommandResult<()> {
    state.services()?;
    store.0.delete(&id).map_err(reject)
}

#[tauri::command]
pub async fn generate_background_image(
    state: State<'_, AppState>,
    store: State<'_, BackgroundService>,
    request_id: String,
    backend_id: String,
    description: String,
) -> CommandResult<String> {
    let generator = state.services()?.background_generation.clone();
    generator.generate(&store, &request_id, &backend_id, &description).await.map_err(reject)
}

#[tauri::command]
pub async fn cancel_background_generation(state: State<'_, AppState>, request_id: String) -> CommandResult<()> {
    state.services()?.background_generation.cancel_generation(&request_id).await;
    Ok(())
}

#[tauri::command]
pub async fn import_background_image(
    state: State<'_, AppState>,
    store: State<'_, BackgroundService>,
    data: String,
) -> CommandResult<String> {
    state.services()?;
    let bytes = decode(&data).map_err(reject)?;
    store.import(&bytes).map_err(reject)
}

#[tauri::command]
pub async fn list_background_images(
    state: State<'_, AppState>,
    store: State<'_, BackgroundService>,
) -> CommandResult<Vec<String>> {
    state.services()?;
    store.list().map_err(reject)
}

#[tauri::command]
pub async fn get_background_image(
    state: State<'_, AppState>,
    store: State<'_, BackgroundService>,
    id: String,
) -> CommandResult<String> {
    state.services()?;
    read_image(&store, &id)
}

fn read_image(store: &BackgroundService, id: &str) -> CommandResult<String> {
    let bytes = store.read(id).map_err(reject)?;
    Ok(format!("data:image/png;base64,{}", STANDARD.encode(bytes)))
}

#[tauri::command]
pub async fn delete_background_image(
    state: State<'_, AppState>,
    store: State<'_, BackgroundService>,
    id: String,
) -> CommandResult<()> {
    state.services()?;
    store.delete(&id).map_err(reject)
}

fn decode(data: &str) -> Result<Vec<u8>, AppError> {
    // Reject before allocating decoded bytes (5 MiB, padded base64).
    if data.len() > guild_domain::attachment::MAX_IMAGE_BYTES.div_ceil(3) * 4 {
        return Err(AppError::validation("Background image exceeds 5 MiB"));
    }
    STANDARD.decode(data).map_err(|_| AppError::validation("Invalid background image base64"))
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn base64_input_is_bounded_and_decoded() {
        assert_eq!(decode("AQID").unwrap(), vec![1, 2, 3]);
        assert!(decode("not base64!").is_err());
        assert!(decode(&"A".repeat(guild_domain::attachment::MAX_IMAGE_BYTES.div_ceil(3) * 4 + 1)).is_err());
    }
}
