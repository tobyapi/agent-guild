export const DRAFT_STORAGE_KEY = 'agent-guild.channel-drafts.v1';

export function loadDraftTexts(): Record<string, string> {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(DRAFT_STORAGE_KEY) ?? '{}');
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
    return Object.fromEntries(Object.entries(raw).filter(([, text]) => typeof text === 'string' && text !== ''));
  } catch {
    return {};
  }
}

export function saveDraftTexts(texts: Record<string, string>): void {
  try {
    if (Object.keys(texts).length === 0) localStorage.removeItem(DRAFT_STORAGE_KEY);
    else localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(texts));
  } catch {
    console.warn('Channel drafts could not be saved; keeping them in memory');
  }
}
