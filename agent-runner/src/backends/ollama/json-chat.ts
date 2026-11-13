import { appendFile, mkdir, rename, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { isJsonObject, type JsonObject } from '../../line-parser.ts';
import { count } from '../../usage.ts';
import { localRef, ollamaRequest, type LocalModel } from './api.ts';
import { BackendError, type RunContext, type RunRequest } from '../types.ts';
import { executeAction, OUTPUT_FORMAT, parseAction, toolInstructions } from './actions.ts';
import { checkOperation } from './chat.ts';
import { t } from './texts/index.ts';
import { NUM_PREDICT } from './limits.ts';
import { throwIfTruncated } from './response.ts';

const ACTION_ITEM_LIMIT = 160;
const ACTION_ARGUMENT_LIMIT = 60;
const ACTION_ERROR_LIMIT = 60;
const ACTION_HISTORY_LIMIT = 10;

function detail(value: string, limit = ACTION_ITEM_LIMIT, fromEnd = false): string {
  const compact = value.replace(/\s+/g, ' ').trim();
  if (compact.length <= limit) return compact;
  return fromEnd ? `…${compact.slice(-(limit - 1))}` : `${compact.slice(0, limit - 1)}…`;
}

function actionArgument(action: JsonObject): string {
  const args = isJsonObject(action.args) ? action.args : action;
  const key =
    action.tool === 'read_file' || action.tool === 'write_file'
      ? 'path'
      : action.tool === 'run_command'
        ? 'command'
        : '';
  const value = key ? args[key] : args;
  if (value === undefined) return '';
  return typeof value === 'string' ? value : JSON.stringify(value);
}

function actionHistory(items: string[]): string {
  const recent = items.slice(-ACTION_HISTORY_LIMIT).join('\n');
  return t('actionHistory', { count: String(items.length), items: recent || t('noActionHistory') });
}

function finalAnswer(action: JsonObject, content: string, history: string[]): string {
  if (typeof action.text !== 'string' || !action.text.trim())
    throw new BackendError('internal', t('finalEmpty', { history: actionHistory(history), content: detail(content) }));
  return action.text.trim();
}

async function logAction(
  request: RunRequest,
  turn: number,
  tool: string,
  target: string,
  contentLength: number | undefined,
  result: string,
  failed: boolean,
): Promise<void> {
  try {
    await mkdir(request.stateDir, { recursive: true });
    const path = join(request.stateDir, 'ollama-actions.jsonl');
    try {
      if ((await stat(path)).size > 1024 * 1024) {
        await rename(path, `${path}.1`).catch(() => undefined);
        await writeFile(path, '');
      }
    } catch {
      /* file does not exist yet */
    }
    const entry = {
      time: new Date().toISOString(),
      turn,
      tool,
      target,
      ...(contentLength === undefined ? {} : { contentLength }),
      resultLength: result.length,
      success: !failed,
      ...(failed ? { error: result.slice('失敗:'.length).trim().slice(0, 200) } : {}),
    };
    await appendFile(path, `${JSON.stringify(entry)}\n`);
  } catch {
    /* action logging must not interrupt the tool loop */
  }
}

async function recordAction(
  history: string[],
  action: JsonObject,
  result: string,
  turn: number,
  request: RunRequest,
  context: RunContext,
): Promise<void> {
  const failed = result.startsWith('失敗:');
  const args = isJsonObject(action.args) ? action.args : action;
  const contentLength =
    action.tool === 'write_file' && typeof args.content === 'string' ? args.content.length : undefined;
  const step = t('actionStep', {
    turn: String(turn),
    name: String(action.tool),
    args: detail(
      actionArgument(action),
      ACTION_ARGUMENT_LIMIT,
      action.tool === 'read_file' || action.tool === 'write_file',
    ),
    status: failed ? t('actionFailed') : t('actionSucceeded'),
    error: failed ? detail(result.slice('失敗:'.length), ACTION_ERROR_LIMIT) : '',
    contentLength: contentLength === undefined ? '' : ` (${contentLength})`,
  });
  history.push(detail(step));
  const target = action.tool === 'run_command' ? args.command : args.path;
  const targetText = typeof target === 'string' ? target.slice(0, 200) : '';
  context.onActivity(`Ollama ${String(action.tool)}: ${targetText}`.trim());
  await logAction(request, turn, String(action.tool), targetText, contentLength, result, failed);
}

function generationOptions(model: LocalModel): JsonObject {
  return { num_predict: NUM_PREDICT, ...(model.capabilities.includes('thinking') ? {} : { temperature: 0 }) };
}

function replyText({ message }: JsonObject): string {
  const text = isJsonObject(message) && typeof message.content === 'string' ? message.content.trim() : '';
  if (!text) throw new BackendError('internal', t('noReply'));
  return text;
}

export async function jsonChat(
  request: RunRequest,
  context: RunContext,
  model: LocalModel,
  prompt: string,
  images: string[],
): Promise<string> {
  const history: string[] = [];
  const messages: JsonObject[] = [
    { role: 'system', content: `${request.systemPrompt}\n\n${toolInstructions(request)}` },
    { role: 'user', content: prompt, ...(images.length ? { images } : {}) },
  ];
  for (let turn = 0; turn < 40; turn++) {
    context.signal.throwIfAborted();
    if (Buffer.byteLength(JSON.stringify(messages)) > 4 * 1024 * 1024)
      throw new BackendError('bad_request', t('conversationTooLarge'));
    const response = await ollamaRequest('/api/chat', context.signal, {
      model: localRef(model.id),
      stream: false,
      format: OUTPUT_FORMAT,
      options: generationOptions(model),
      ...(model.capabilities.includes('thinking') ? { think: false } : {}),
      messages,
    });
    context.signal.throwIfAborted();
    throwIfTruncated(response);
    context.onUsage({ inputTokens: count(response.prompt_eval_count), outputTokens: count(response.eval_count) });
    const content = replyText(response);
    const action = parseAction(content);
    if (action.type === 'final') return finalAnswer(action, content, history);
    messages.push({ role: 'assistant', content });
    let result: string;
    try {
      await checkOperation(request, model, String(action.tool), action, context.signal);
      result = await executeAction(action, request, context);
    } catch (error) {
      context.signal.throwIfAborted();
      if (error instanceof BackendError && error.code === 'unsupported_permission') throw error;
      result = error instanceof BackendError ? `失敗: ${error.message}` : '失敗: 操作を完了できませんでした';
    }
    await recordAction(history, action, result, turn + 1, request, context);
    messages.push({
      role: 'user',
      content: `直前の操作要求: ${content}\nツール実行結果（資料）:\n${result}\nこの結果を確認し、完了した手順の次へ進んでください。`,
    });
  }
  throw new BackendError('internal', t('actionLimit', { history: actionHistory(history) }));
}
