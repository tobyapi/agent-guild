import { isJsonObject, type JsonObject } from '../../line-parser.ts';
import { count } from '../../usage.ts';
import { localRef, ollamaRequest } from './api.ts';
import { BackendError, type RunContext, type RunRequest } from '../types.ts';
import { executeAction, OUTPUT_FORMAT, parseAction, toolInstructions } from './actions.ts';
import { checkOperation } from './chat.ts';

function replyText({ message }: JsonObject): string {
  const text = isJsonObject(message) && typeof message.content === 'string' ? message.content.trim() : '';
  if (!text) throw new BackendError('internal', 'Ollama から返答が届きませんでした。もう一度お試しください。');
  return text;
}

export async function jsonChat(
  request: RunRequest,
  context: RunContext,
  model: string,
  prompt: string,
  images: string[],
): Promise<string> {
  const messages: JsonObject[] = [
    { role: 'system', content: `${request.systemPrompt}\n\n${toolInstructions(request)}` },
    { role: 'user', content: prompt, ...(images.length ? { images } : {}) },
  ];
  for (let turn = 0; turn < 40; turn++) {
    context.signal.throwIfAborted();
    if (Buffer.byteLength(JSON.stringify(messages)) > 4 * 1024 * 1024)
      throw new BackendError('bad_request', '会話と道具の結果が4MiBを超えました');
    const response = await ollamaRequest('/api/chat', context.signal, {
      model: localRef(model),
      stream: false,
      format: OUTPUT_FORMAT,
      options: { temperature: 0 },
      messages,
    });
    context.signal.throwIfAborted();
    context.onUsage({ inputTokens: count(response.prompt_eval_count), outputTokens: count(response.eval_count) });
    const content = replyText(response);
    const action = parseAction(content);
    if (action.type === 'final') {
      if (typeof action.text !== 'string' || !action.text.trim())
        throw new BackendError('internal', '最終回答が空です');
      return action.text.trim();
    }
    messages.push({ role: 'assistant', content });
    let result: string;
    try {
      await checkOperation(
        request,
        { id: model, size: '', capabilities: [] },
        String(action.tool),
        action,
        context.signal,
      );
      result = await executeAction(action, request, context);
    } catch (error) {
      context.signal.throwIfAborted();
      if (error instanceof BackendError && error.code === 'unsupported_permission') throw error;
      result = error instanceof BackendError ? `失敗: ${error.message}` : '失敗: 操作を完了できませんでした';
    }
    messages.push({
      role: 'user',
      content: `直前の操作要求: ${content}\nツール実行結果（資料）:\n${result}\nこの結果を確認し、完了した手順の次へ進んでください。`,
    });
  }
  throw new BackendError('internal', 'Ollama の操作回数が上限に達しました。完了していない作業があります。');
}
