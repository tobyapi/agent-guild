import { readFile } from 'node:fs/promises';
import { isJsonObject, type JsonObject } from '../line-parser.ts';
import type { ImagePayload, ModelSpec } from '../protocol.ts';
import { localChatModels, localRef, ollamaRequest, OllamaStopped, type LocalModel } from './ollama/api.ts';
import { BackendError, type BackendAdapter, type BackendProbe, type RunContext, type RunRequest } from './types.ts';
import { count } from '../usage.ts';

const NO_MODELS = 'Ollama に会話用のローカルモデルを追加して「再確認」を押してください。';

function modelSpec(model: LocalModel): ModelSpec {
  const input = model.capabilities.includes('vision') ? '画像と文章に対応' : '文章に対応';
  return {
    id: model.id,
    label: model.id,
    description: [model.size, input].filter(Boolean).join(' · '),
    efforts: [],
    defaultEffort: null,
  };
}

async function probe(): Promise<BackendProbe> {
  try {
    const models = (await localChatModels()).map(modelSpec);
    return {
      status: models.length === 0 ? 'unavailable' : 'ready',
      statusMessage: models.length === 0 ? NO_MODELS : 'この PC のモデルを使います。',
      models,
      defaultModel: models[0]?.id ?? '',
    };
  } catch (error) {
    if (process.platform !== 'darwin' || !(error instanceof OllamaStopped)) throw error;
    return { status: 'stopped', statusMessage: '起動すると、この Mac に入っているモデルを読み込みます。' };
  }
}

async function encodeImage(image: ImagePayload, signal: AbortSignal): Promise<string> {
  try {
    return (await readFile(image.path, { signal })).toString('base64');
  } catch {
    signal.throwIfAborted();
    throw new BackendError('bad_request', '添付画像を読み込めませんでした。');
  }
}

function replyText({ message }: JsonObject): string {
  const text = isJsonObject(message) && typeof message.content === 'string' ? message.content.trim() : '';
  if (!text) throw new BackendError('internal', 'Ollama から返答が届きませんでした。もう一度お試しください。');
  return text;
}

async function run(request: RunRequest, { signal, onActivity, onUsage }: RunContext): Promise<string> {
  signal.throwIfAborted();
  const models = await localChatModels(signal);
  const model = request.model === '' ? models[0] : models.find((candidate) => candidate.id === request.model);
  if (!model)
    throw new BackendError('model_not_found', request.model ? `${request.model} が Ollama にありません。` : NO_MODELS);
  const vision = model.capabilities.includes('vision');
  const skippedImages = !vision && request.images.length > 0;
  const images = vision ? await Promise.all(request.images.map((image) => encodeImage(image, signal))) : [];
  const prompt = skippedImages
    ? `${request.prompt}\n\n添付画像は入力されていません。画像の内容を推測せず、文章から分かる範囲で答えてください。`
    : request.prompt;
  onActivity(`${model.id} で返答を作成しています…`);
  onUsage({ model: model.id });
  const response = await ollamaRequest('/api/chat', signal, {
    model: localRef(model.id),
    stream: false,
    messages: [
      { role: 'system', content: request.systemPrompt },
      { role: 'user', content: prompt, ...(images.length > 0 ? { images } : {}) },
    ],
  });
  onUsage({ inputTokens: count(response.prompt_eval_count), outputTokens: count(response.eval_count) });
  const text = replyText(response);
  if (!skippedImages || text === '[PASS]') return text;
  return `${text}\n\n（${model.id} は文章のみ対応のため、添付画像は読み取っていません。）`;
}

export const ollamaAdapter: BackendAdapter = {
  info: () => ({
    id: 'ollama',
    label: 'Ollama（この PC）',
    capabilities: {
      webSearch: false,
      webFetch: false,
      readFiles: false,
      readAnywhere: false,
      writeFiles: false,
      writeAnywhere: false,
      runCommands: false,
      skills: false,
    },
    options: [],
    permissionRules: [],
    leakRisks: [],
    canLogin: false,
    midRunPost: null,
  }),
  probe,
  run,
};
