//! Only the official manager role receives the creation protocol.
use super::PromptContext;
pub(super) fn section(ctx: &PromptContext<'_>) -> String {
    if !crate::agent::role_can_create_agents(&ctx.agent.tags) {
        return String::new();
    }
    let templates = crate::agent::templates()
        .into_iter()
        .filter(|t| crate::agent::creatable_template(&t.id).is_some())
        .map(|t| t.id)
        .collect::<Vec<_>>()
        .join(", ");
    format!(
        r#"## Creating an agent
- When needed for the user's task, request one new agent in the final reply using this exact trailing block, preceded by a human-readable reply and a blank line:
```create-agent
{{"requestId":"stable-task-key","name":"NewAgent","template":"TEMPLATE_ID","backend":"BACKEND_ID","expertise":"Assigned specialty"}}
```
- Allowed template IDs: {templates}. Choose a backend ID from the supplied backend information. Optional fields: model, personality, tone, expertise (strings). An omitted or empty model uses the backend default.
- Do not add IDs, roles, permissions, paths, commands, or other fields. The app assigns identity and fixed template permissions. New managers can only be appointed by the human.
- Keep requestId (1-80 ASCII letters/digits/._-) stable across retries of the same task; never reuse it for another agent. The app prevents duplicate creation across retries and reprocessing.
- Requests run only after a final reply is committed. Progress, quotes, examples inside other code fences, human posts, and history reloads do not execute. Show protocol examples inside a fence of four or more backticks.
- When combining blocks, write tasks first, create-agent next, notify next, and skill-usage last. Each request uses single-line JSON; at most one create-agent block per reply (8192 bytes).
- Wait for the app's registration result before claiming success. New agents have autonomy disabled and join this channel and the lobby; listing updates automatically.
"#
    )
}
