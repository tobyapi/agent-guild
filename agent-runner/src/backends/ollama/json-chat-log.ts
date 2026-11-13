import { appendFile, mkdir, rename, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { isJsonObject, type JsonObject } from '../../line-parser.ts';
import { BackendError, type RunContext, type RunRequest } from '../types.ts';
import { replyMetrics } from './response.ts';
import { t } from './texts/index.ts';

const ACTION_ARGUMENT_LIMIT = 60;
const ACTION_ERROR_LIMIT = 60;

function detail(value: string, limit = 160, fromEnd = false): string {
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

export async function logAction(
  request: RunRequest,
  turn: number,
  tool: string,
  target: string,
  contentLength: number | undefined,
  result: string,
  failed: boolean,
  reply: ReturnType<typeof replyMetrics>,
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
      ...reply,
      resultLength: result.length,
      success: !failed,
      ...(failed ? { error: result.slice(0, 200) } : {}),
    };
    await appendFile(path, `${JSON.stringify(entry)}\n`);
  } catch {
    /* action logging must not interrupt the tool loop */
  }
}

export async function recordAction(
  history: string[],
  action: JsonObject,
  result: string,
  turn: number,
  request: RunRequest,
  context: RunContext,
  metrics: ReturnType<typeof replyMetrics>,
): Promise<void> {
  const failed = result.startsWith('失敗:') || result.startsWith('停止:');
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
    error: failed ? detail(result.replace(/^(失敗|停止):/, ''), ACTION_ERROR_LIMIT) : '',
    contentLength: contentLength === undefined ? '' : ` (${contentLength})`,
  });
  history.push(detail(step));
  const target = action.tool === 'run_command' ? args.command : args.path;
  const targetText = typeof target === 'string' ? target.slice(0, 200) : '';
  context.onActivity(`Ollama ${String(action.tool)}: ${targetText}`.trim());
  await logAction(request, turn, String(action.tool), targetText, contentLength, result, failed, metrics);
}

export async function recordPermissionStop(
  history: string[],
  action: JsonObject,
  error: BackendError,
  turn: number,
  request: RunRequest,
  context: RunContext,
  content: string,
  evalCount: number | undefined,
): Promise<never> {
  try {
    await recordAction(
      history,
      action,
      `停止: ${error.message}`,
      turn,
      request,
      context,
      replyMetrics(content, evalCount),
    );
  } catch {
    // Preserve the original permission error if recording fails.
  }
  throw error;
}
