import { isJsonObject, type JsonObject } from '../../line-parser.ts';
import { count } from '../../usage.ts';
import { localRef, ollamaRequest, type LocalModel } from './api.ts';
import { BackendError, type RunContext, type RunRequest } from '../types.ts';
import { executeAction, OUTPUT_FORMAT, parseAction, toolInstructions } from './actions.ts';
import { logAction, recordAction, recordPermissionStop } from './json-chat-log.ts';
import { checkOperation } from './chat.ts';
import { t } from './texts/index.ts';
import { NUM_PREDICT } from './limits.ts';
import { replyMetrics, throwIfTruncated } from './response.ts';

const ACTION_ITEM_LIMIT = 160;
const ACTION_HISTORY_LIMIT = 10;
const TOOL_NAMES = new Set(['read_file', 'list_files', 'write_file', 'run_command', 'read_skill', 'post']);
const INVALID_TOOL_RESULT =
  '失敗: type が tool のときは、tool に道具の名前（read_file・list_files・write_file・run_command・read_skill・post のどれか）を入れてください。作業が終わったなら type を final にしてください';

function detail(value: string, limit = ACTION_ITEM_LIMIT, fromEnd = false): string {
  const compact = value.replace(/\s+/g, ' ').trim();
  if (compact.length <= limit) return compact;
  return fromEnd ? `…${compact.slice(-(limit - 1))}` : `${compact.slice(0, limit - 1)}…`;
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

function generationOptions(model: LocalModel): JsonObject {
  return { num_predict: NUM_PREDICT, ...(model.capabilities.includes('thinking') ? {} : { temperature: 0 }) };
}

function replyText({ message }: JsonObject): string {
  const text = isJsonObject(message) && typeof message.content === 'string' ? message.content.trim() : '';
  if (!text) throw new BackendError('internal', t('noReply'));
  return text;
}

async function rejectTruncatedReply(response: JsonObject, request: RunRequest, turn: number): Promise<void> {
  if (response.done_reason !== 'length') return;
  const raw =
    isJsonObject(response.message) && typeof response.message.content === 'string' ? response.message.content : '';
  await logAction(request, turn, '(truncated)', '', undefined, '', true, replyMetrics(raw, count(response.eval_count)));
  throwIfTruncated(response);
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
    await rejectTruncatedReply(response, request, turn + 1);
    context.onUsage({ inputTokens: count(response.prompt_eval_count), outputTokens: count(response.eval_count) });
    const content = replyText(response);
    const action = parseAction(content);
    if (action.type === 'final') return finalAnswer(action, content, history);
    messages.push({ role: 'assistant', content });
    let result: string;
    if (typeof action.tool !== 'string' || !TOOL_NAMES.has(action.tool)) {
      result = INVALID_TOOL_RESULT;
    } else {
      try {
        await checkOperation(request, model, action.tool, action, context.signal);
        result = await executeAction(action, request, context);
      } catch (error) {
        context.signal.throwIfAborted();
        if (error instanceof BackendError && error.code === 'unsupported_permission') {
          await recordPermissionStop(
            history,
            action,
            error,
            turn + 1,
            request,
            context,
            content,
            count(response.eval_count),
          );
        }
        result = error instanceof BackendError ? `失敗: ${error.message}` : '失敗: 操作を完了できませんでした';
      }
    }
    await recordAction(
      history,
      action,
      result,
      turn + 1,
      request,
      context,
      replyMetrics(content, count(response.eval_count)),
    );
    messages.push({
      role: 'user',
      content: `直前の操作要求: ${content}\nツール実行結果（資料）:\n${result}\nこの結果を確認し、完了した手順の次へ進んでください。`,
    });
  }
  throw new BackendError('internal', t('actionLimit', { history: actionHistory(history) }));
}
