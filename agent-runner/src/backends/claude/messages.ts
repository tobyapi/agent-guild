// query() が流すメッセージの処理: ツール呼び出しを途中経過にし、最終テキストを取り出し、失敗を ErrorCode に対応づける。

import type {
  SDKAssistantMessage,
  SDKAssistantMessageError,
  SDKMessage,
  SDKResultMessage,
} from '@anthropic-ai/claude-agent-sdk';
import type { ErrorCode, RunUsage } from '../../protocol.ts';
import { activity, describeTool } from '../describe.ts';
import { BackendError, classifyErrorText } from '../types.ts';
import { COMMAND_TOOL } from './command.ts';
import { POST_TOOL } from './post.ts';
import { t } from './texts/index.ts';
import { claudeUsage } from './usage.ts';

const ASSISTANT_ERROR_CODES: Readonly<Record<SDKAssistantMessageError, ErrorCode>> = {
  authentication_failed: 'auth',
  oauth_org_not_allowed: 'auth',
  account_on_hold: 'auth',
  verification_required: 'auth',
  cloud_credential_error: 'auth',
  billing_error: 'rate_limit',
  rate_limit: 'rate_limit',
  overloaded: 'rate_limit',
  model_not_found: 'model_not_found',
  invalid_request: 'internal',
  server_error: 'internal',
  max_output_tokens: 'internal',
  unknown: 'internal',
};

const HINTS: Partial<Record<ErrorCode, 'hintAuth' | 'hintRateLimit' | 'hintModelNotFound'>> = {
  auth: 'hintAuth',
  rate_limit: 'hintRateLimit',
  model_not_found: 'hintModelNotFound',
};

const textOf = (message: SDKAssistantMessage): string =>
  message.message.content
    .flatMap((block) => (block.type === 'text' ? [block.text] : []))
    .join('')
    .trim();

function assistantError(message: SDKAssistantMessage, error: SDKAssistantMessageError): BackendError {
  const code = ASSISTANT_ERROR_CODES[error] ?? 'internal';
  const detail = textOf(message) || error;
  const hint = HINTS[code];
  return new BackendError(code, hint ? t('hintDetail', { hint: t(hint), detail }) : t('failed', { detail }));
}

/** 隔離の中のコマンドは、進捗の表示では内蔵の Bash と同じ「コマンド実行」にする */
const toolName = (name: string): string => (name === COMMAND_TOOL ? 'Bash' : name);

/** assistant メッセージを途中経過として流し、本文があれば返す */
function readAssistant(message: SDKAssistantMessage, onActivity: (detail: string) => void): string | undefined {
  if (message.error) throw assistantError(message, message.error);
  let text: string | undefined;
  for (const block of message.message.content) {
    if (block.type === 'tool_use') {
      onActivity(block.name === POST_TOOL ? activity.posting() : describeTool(toolName(block.name), block.input));
    } else if (block.type === 'text' && block.text.trim() !== '') {
      text = block.text;
      onActivity(activity.writing());
    }
  }
  return text;
}

function readResult(message: SDKResultMessage, lastText: string): string {
  if (message.subtype === 'success' && !message.is_error) return message.result || lastText;
  const detail = message.subtype === 'success' ? message.result : message.errors.join(' / ') || message.subtype;
  throw new BackendError(classifyErrorText(detail), t('interrupted', { detail }));
}

/** メッセージを最後まで読み、最終テキストを返す（result が来たらそこで終わる。抜けると SDK が子プロセスを片づける） */
export async function consumeMessages(
  messages: AsyncIterable<SDKMessage>,
  onActivity: (detail: string) => void,
  onUsage: (usage: RunUsage) => void,
): Promise<string> {
  let lastText = '';
  let sawMainModel = false;
  for await (const message of messages) {
    if (message.type === 'assistant') {
      if (!sawMainModel && !message.parent_tool_use_id && message.message.model) {
        sawMainModel = true;
        onUsage({ model: message.message.model });
      }
      lastText = readAssistant(message, onActivity) ?? lastText;
    } else if (message.type === 'result') {
      onUsage(claudeUsage(message));
      return readResult(message, lastText);
    }
  }
  return lastText;
}
