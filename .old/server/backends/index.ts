import type { BackendId } from '../../shared/types.js';
import type { AgentBackend } from './types.js';
import { claudeBackend } from './claude.js';
import { codexBackend } from './codex.js';

const registry: Record<BackendId, AgentBackend> = {
  claude: claudeBackend,
  codex: codexBackend,
};

export const getBackend = (id: BackendId): AgentBackend => registry[id] ?? claudeBackend;
export const listBackends = () => Object.values(registry).map((b) => b.info);
