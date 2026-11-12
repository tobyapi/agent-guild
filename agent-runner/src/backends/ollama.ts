import { readFile } from 'node:fs/promises';
import type { ImagePayload, ModelSpec, Permissions } from '../protocol.ts';
import { localChatModels, OllamaStopped, type LocalModel } from './ollama/api.ts';
import {
  BackendError,
  NO_SETUP,
  type BackendAdapter,
  type BackendProbe,
  type RunContext,
  type RunRequest,
} from './types.ts';
import { prepareSkills } from './ollama/skills.ts';
import { jsonChat } from './ollama/json-chat.ts';
import { PERMISSION_RULES, validatePermissions } from './ollama/policy.ts';
import { toolChat } from './ollama/chat.ts';
import { prepareCommandSandbox } from './command-sandbox.ts';
import { canIsolate, canRunCommands } from './ollama/sandbox.ts';
import { t } from './ollama/texts/index.ts';

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

function modelSpec(model: LocalModel): ModelSpec {
  const input = model.capabilities.includes('vision') ? t('vision') : t('textOnly');
  return {
    id: model.id,
    label: model.id,
    description: [model.size, input, model.capabilities.includes('tools') ? t('nativeTools') : t('jsonTools')]
      .filter(Boolean)
      .join(' · '),
    efforts: [],
    defaultEffort: null,
    // The app also provides JSON actions for completion models without native tools.
    tools: true,
  };
}

async function probe(): Promise<BackendProbe> {
  // コマンドの隔離が使えるかを先に確かめる（能力の申告 info() が、この結果を使う）
  await prepareCommandSandbox();
  try {
    const models = (await localChatModels()).map(modelSpec);
    return {
      status: models.length === 0 ? 'unavailable' : 'ready',
      statusMessage: models.length === 0 ? t('noModels') : t('ready'),
      models,
      defaultModel: models[0]?.id ?? '',
    };
  } catch (error) {
    if (process.platform !== 'darwin' || !(error instanceof OllamaStopped)) throw error;
    return { status: 'stopped', statusMessage: t('stopped') };
  }
}

async function encodeImage(image: ImagePayload, signal: AbortSignal): Promise<string> {
  try {
    return (await readFile(image.path, { signal })).toString('base64');
  } catch {
    signal.throwIfAborted();
    throw new BackendError('bad_request', t('imageRead'));
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
  if (enabled) {
    validatePermissions(request);
    await prepareCommandSandbox();
  }
  const models = await localChatModels(signal);
  const model = request.model === '' ? models[0] : models.find((candidate) => candidate.id === request.model);
  if (!model)
    throw new BackendError(
      'model_not_found',
      request.model ? t('modelMissing', { model: request.model }) : t('noModels'),
    );
  const vision = model.capabilities.includes('vision');
  const skippedImages = !vision && request.images.length > 0;
  const images = vision ? await Promise.all(request.images.map((image) => encodeImage(image, signal))) : [];
  const prompt = skippedImages
    ? `${request.prompt}\n\n添付画像は入力されていません。画像の内容を推測せず、文章から分かる範囲で答えてください。`
    : request.prompt;
  onActivity(t('responding', { model: model.id }));
  onUsage({ model: model.id });
  const text = await respond(request, context, model, prompt, images, enabled);
  if (!skippedImages || text === '[PASS]') return text;
  return `${text}\n\n${t('imageSkipped', { model: model.id })}`;
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
    label: t('label'),
    capabilities: {
      webSearch: false,
      webFetch: false,
      // ファイルとスキルは、どの OS でも作業場所の範囲をパスの判定で守って使う。コマンドは OS の隔離
      // （macOS の Seatbelt・Windows の MXC）の中でだけ、PC 全体への書き込みは Seatbelt があるときだけ使う
      readFiles: true,
      readAnywhere: false,
      writeFiles: true,
      writeAnywhere: canIsolate(),
      runCommands: canRunCommands(),
      skills: true,
    },
    options: [
      {
        key: 'toolProtocol',
        label: t('toolProtocolLabel'),
        description: t('toolProtocolDescription'),
        type: 'select',
        choices: ['auto', 'json'],
        default: 'auto',
      },
      {
        key: 'enableTools',
        label: t('enableToolsLabel'),
        description: t('enableToolsDescription'),
        type: 'boolean',
        choices: [],
        default: false,
      },
      {
        key: 'operationCheck',
        label: t('operationCheckLabel'),
        description: t('operationCheckDescription'),
        type: 'boolean',
        choices: [],
        default: true,
      },
    ],
    permissionRules: PERMISSION_RULES,
    leakRisks: [],
    unrestricted: [],
    midRunPost: 'tool',
    folderScope: 'files',
    toolsOption: 'enableTools',
    local: true,
    setup: { ...NO_SETUP, start: process.platform === 'darwin' ? { macBundleId: 'com.electron.ollama' } : null },
  }),
  probe,
  run,
};
