import { apiKeyEnvironment } from '../credentials/store.ts';
import { withoutSecrets } from './agent-env.ts';

export type BackendAuthMode = 'desktop' | 'api';

const modes = new Map<string, BackendAuthMode>();

export function backendAuthMode(backend: string): BackendAuthMode {
  return modes.get(backend) ?? 'desktop';
}

export function setBackendAuthMode(backend: string, mode: BackendAuthMode): void {
  if (backend !== 'claude' && backend !== 'codex') throw new Error('Unsupported backend auth mode');
  modes.set(backend, mode);
}

export async function claudeAuthEnvironment(env: NodeJS.ProcessEnv): Promise<Record<string, string>> {
  if (backendAuthMode('claude') === 'desktop') return withoutSecrets(env, (name) => name !== 'ANTHROPIC_API_KEY');
  const credentials = await apiKeyEnvironment('claude', 'ANTHROPIC_API_KEY');
  if (!credentials.ANTHROPIC_API_KEY?.trim()) throw new Error('Claude API key is required in API mode');
  return { ...withoutSecrets(env, (name) => name !== 'ANTHROPIC_API_KEY'), ANTHROPIC_API_KEY: credentials.ANTHROPIC_API_KEY };
}

export async function codexAuthEnvironment(env: NodeJS.ProcessEnv): Promise<Record<string, string>> {
  if (backendAuthMode('codex') === 'desktop') return withoutSecrets(env, (name) => name !== 'OPENAI_API_KEY');
  const credentials = await apiKeyEnvironment('codex', 'OPENAI_API_KEY');
  if (!credentials.OPENAI_API_KEY?.trim()) throw new Error('Codex API key is required in API mode');
  return { ...withoutSecrets(env, (name) => name !== 'OPENAI_API_KEY'), OPENAI_API_KEY: credentials.OPENAI_API_KEY };
}
