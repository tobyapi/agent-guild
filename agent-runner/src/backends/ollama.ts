import { readFile } from 'node:fs/promises';
import type { ImagePayload, ModelSpec, Permissions } from '../protocol.ts';
import { localChatModels, OllamaStopped, type LocalModel } from './ollama/api.ts';
import { BackendError, type BackendAdapter, type BackendProbe, type RunContext, type RunRequest } from './types.ts';
import { prepareSkills } from './ollama/skills.ts';
import { jsonChat } from './ollama/json-chat.ts';
import { PERMISSION_RULES, validatePermissions } from './ollama/policy.ts';
import { toolChat } from './ollama/chat.ts';
import { canIsolate } from './ollama/sandbox.ts';

const NO_TOOLS: Permissions = {
  webSearch: false,
  webFetch: false,
  readFiles: false,
  readAnywhere: false,
  writeFiles: false,
  writeAnywhere: false,
  runCommands: false,
  skills: false,
};
const NO_MODELS = 'Ollama に会話用のローカルモデルを追加して「再確認」を押してください。';

function modelSpec(model: LocalModel): ModelSpec {
  const input = model.capabilities.includes('vision') ? '画像と文章に対応' : '文章に対応';
  return {
    id: model.id,
    label: model.id,
    description: [model.size, input, model.capabilities.includes('tools') ? '道具に対応' : 'JSON 操作（試作）']
      .filter(Boolean)
      .join(' · '),
    efforts: [],
    defaultEffort: null,
    // The app also provides JSON actions for completion models without native tools.
    tools: true,
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

async function run(request: RunRequest, context: RunContext): Promise<string> {
  let { signal } = context;
  const { onActivity, onUsage } = context;
  signal = AbortSignal.any([signal, AbortSignal.timeout(5 * 60_000)]);
  signal.throwIfAborted();
  context = { ...context, signal };
  const enabled = request.options.enableTools === true;
  // 道具を有効にしていなければ会話だけ（役割の権限があっても、どの操作も使わない）
  if (!enabled) request = { ...request, permissions: NO_TOOLS };
  if (enabled) validatePermissions(request);
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
  const text = await respond(request, context, model, prompt, images, enabled);
  if (!skippedImages || text === '[PASS]') return text;
  return `${text}\n\n（${model.id} は文章のみ対応のため、添付画像は読み取っていません。）`;
}

async function respond(
  request: RunRequest,
  context: RunContext,
  model: LocalModel,
  prompt: string,
  images: string[],
  enabled: boolean,
): Promise<string> {
  const prepared = enabled ? await prepareSkills(request) : { request, cleanup: () => Promise.resolve() };
  try {
    return enabled && (request.options.toolProtocol === 'json' || !model.capabilities.includes('tools'))
      ? await jsonChat(prepared.request, context, model.id, prompt, images)
      : await toolChat(prepared.request, model, prompt, images, context.signal, context);
  } finally {
    await prepared.cleanup();
  }
}

export const ollamaAdapter: BackendAdapter = {
  info: () => ({
    id: 'ollama',
    label: 'Ollama（この PC）',
    capabilities: {
      webSearch: false,
      webFetch: false,
      // ファイルとスキルは、どの OS でも作業場所の範囲をパスの判定で守って使う。コマンドと PC 全体への書き込みは、
      // OS の隔離（macOS の Seatbelt）で閉じ込められるときだけ使う
      readFiles: true,
      readAnywhere: false,
      writeFiles: true,
      writeAnywhere: canIsolate(),
      runCommands: canIsolate(),
      skills: true,
    },
    options: [
      {
        key: 'toolProtocol',
        label: '道具の要求形式',
        description:
          'auto は対応モデルのネイティブ呼び出しを使います。操作を呼ばない DeepSeek などでは json を選んでください。',
        type: 'select',
        choices: ['auto', 'json'],
        default: 'auto',
      },
      {
        key: 'enableTools',
        label: '道具の利用を有効にする',
        description:
          '役割の権限で道具（ファイルの読み書き・スキル・途中の投稿）を実行します。DeepSeek などは JSON 操作を使います。コマンド（単一プロセス）と作業フォルダの外への書き込みは、隔離できる macOS だけで使います。',
        type: 'boolean',
        choices: [],
        default: false,
      },
      {
        key: 'operationCheck',
        label: '操作を実行前に確認する',
        description: 'コマンドと PC 全体への書き込みを、依頼に沿うかモデルで確認します。',
        type: 'boolean',
        choices: [],
        default: true,
      },
    ],
    permissionRules: PERMISSION_RULES,
    leakRisks: [],
    unrestricted: [],
    canLogin: false,
    midRunPost: 'tool',
  }),
  probe,
  run,
};
