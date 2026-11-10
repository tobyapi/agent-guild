import { isJsonObject, type JsonObject } from '../../line-parser.ts';
import { BackendError } from '../types.ts';
import { localHttp } from './http.ts';

const PROBE_TIMEOUT_MS = 5000;
const CONNECTION_HELP = 'Ollama アプリを起動して「再確認」を押してください。';

export class OllamaStopped extends BackendError {
  constructor() {
    super('internal', `Ollama に接続できませんでした。${CONNECTION_HELP}`);
  }
}

export interface LocalModel {
  id: string;
  size: string;
  capabilities: string[];
}

/** Ollama 側でもローカルに限定し、同じ名前のクラウドモデルへの転送を防ぐ。 */
export const localRef = (model: string): string => `${model}:local`;

export async function ollamaRequest(
  path: '/api/tags' | '/api/show' | '/api/chat',
  signal: AbortSignal,
  body?: JsonObject,
): Promise<JsonObject> {
  const { status, text } = await localHttp(path, signal, body === undefined ? undefined : JSON.stringify(body)).catch(
    (error: unknown) => {
      if (path === '/api/tags' && isJsonObject(error) && error.code === 'ECONNREFUSED') throw new OllamaStopped();
      throw new BackendError('internal', `Ollama に接続できませんでした。${CONNECTION_HELP}`);
    },
  );
  if (status !== 200) {
    if (status === 404 && path !== '/api/tags') {
      throw new BackendError('model_not_found', 'Ollama のローカルモデルが見つかりません。モデルを確認してください。');
    }
    if (status === 413)
      throw new BackendError('bad_request', 'Ollama に渡す入力が大きすぎます。添付画像を減らしてください。');
    throw new BackendError('internal', `Ollama からエラーが返りました（HTTP ${status}）。${CONNECTION_HELP}`);
  }
  return parseResponse(text);
}

function parseResponse(text: string): JsonObject {
  try {
    const result: unknown = JSON.parse(text);
    if (isJsonObject(result)) return result;
  } catch {
    // サーバーのエラー本文は会話に出さない。
  }
  throw new BackendError('internal', 'Ollama の応答を読み取れませんでした。');
}

function capabilities(value: unknown): string[] | undefined {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : undefined;
}

function isRemote(model: JsonObject): boolean {
  return Boolean(model.remote_host || model.remote_model);
}

async function chatModel(entry: unknown, signal: AbortSignal): Promise<LocalModel | null> {
  if (!isJsonObject(entry) || isRemote(entry)) return null;
  const id = typeof entry.model === 'string' ? entry.model : entry.name;
  if (typeof id !== 'string' || !id.trim() || /:(?:cloud|local|[^:/]*-cloud)$/i.test(id)) return null;
  const caps = capabilities(entry.capabilities) ?? (await readCapabilities(id, signal));
  if (!caps.includes('completion')) return null;
  const size = isJsonObject(entry.details) ? entry.details.parameter_size : undefined;
  return { id, size: typeof size === 'string' ? size : '', capabilities: caps };
}

/** 古い Ollama は一覧に能力を含めないため、その場合だけ詳細を取得する。 */
async function readCapabilities(id: string, signal: AbortSignal): Promise<string[]> {
  const details = await ollamaRequest('/api/show', signal, { model: localRef(id) }).catch((error: unknown) => {
    if (error instanceof BackendError && error.code === 'model_not_found') return null;
    throw error;
  });
  return details === null || isRemote(details) ? [] : (capabilities(details.capabilities) ?? []);
}

export async function localChatModels(cancel?: AbortSignal): Promise<LocalModel[]> {
  const deadline = AbortSignal.timeout(PROBE_TIMEOUT_MS);
  const signal = cancel ? AbortSignal.any([deadline, cancel]) : deadline;
  const { models } = await ollamaRequest('/api/tags', signal);
  if (!Array.isArray(models)) throw new BackendError('internal', 'Ollama のモデル一覧を読み取れませんでした。');
  const found = await Promise.all(models.map((entry: unknown) => chatModel(entry, signal)));
  return found.filter((model) => model !== null).sort((a, b) => a.id.localeCompare(b.id, 'en'));
}
