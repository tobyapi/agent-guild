// agent-runner のエントリ。stdio の JSON Lines の読み書きだけを行い、要求の処理は Dispatcher に任せる。
// 開発時は `node agent-runner/src/main.ts`（Node の型ストリップ）で動く。

import packageJson from '../../package.json' with { type: 'json' };
import { createBuiltinRegistry } from './backends/registry.ts';
import { Dispatcher } from './dispatcher.ts';
import { LineSplitter, parseLine, serializeEvent } from './line-parser.ts';
import { logError, redirectConsoleToStderr } from './log.ts';
import type { RunnerEvent } from './protocol.ts';

/** shutdown 後、何かがイベントループを止めずに残っていても抜ける猶予 */
const EXIT_GRACE_MS = 2000;

redirectConsoleToStderr();

function send(event: RunnerEvent): void {
  process.stdout.write(serializeEvent(event));
}

function exit(): void {
  process.stdin.pause();
  // 書きかけの出力を流しきってから終わる
  process.stdout.write('', () => process.exit(0));
  setTimeout(() => process.exit(0), EXIT_GRACE_MS).unref();
}

const dispatcher = new Dispatcher({
  registry: createBuiltinRegistry(),
  runnerVersion: packageJson.version,
  send,
  exit,
});
const splitter = new LineSplitter();
const receive = (lines: string[]): void => lines.forEach((line) => dispatcher.receive(parseLine(line)));

// どんな入力・どんなアダプタの失敗でもプロセスを落とさない（ログに残して続ける）
process.on('uncaughtException', (error) => logError('捕捉されない例外', error));
process.on('unhandledRejection', (reason) => logError('処理されない Promise の拒否', reason));
// Rust 側がいなくなった（パイプが閉じた）ら終わる
process.stdout.on('error', () => process.exit(0));

process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk: string) => receive(splitter.push(chunk)));
// stdin の EOF（親が落ちた・閉じた）では全実行を中断して終わる。孤児にならない
process.stdin.on('end', () => {
  receive(splitter.flush());
  dispatcher.shutdown();
});

dispatcher.announce().catch((error: unknown) => logError('ready を送れませんでした', error));
