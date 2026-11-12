import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { BackendError } from '../backends/types.ts';
import { WINDOWS_CREDENTIAL_SCRIPT } from './windows-script.ts';

// バックエンドの API キーを OS の資格情報ストアに保存する。どのバックエンドが使えるか・代わりに使う環境変数の名前は、
// アダプタが申告する（BackendInfo.setup.apiKey）。
export type KeyAction = 'status' | 'set' | 'delete';
/** 資格情報の名前に使えるバックエンド ID の形（windows-script.ts も同じ形だけを受け付ける） */
const BACKEND_ID = /^[a-z][a-z0-9-]{0,31}$/;
const STORE_FAILURE = 'OSの資格情報ストアを利用できない。Windowsの資格情報管理とPowerShellを確認してください。';
const pending = new Map<string, Promise<unknown>>();

// No plaintext fallback. A failed read must never silently select a different credential.
export function credentialStore(
  backend: string,
  action: 'get' | 'set' | 'delete',
  key?: string,
): Promise<string | null> {
  const operation = (pending.get(backend) ?? Promise.resolve())
    .catch(() => {})
    .then(() => operate(backend, action, key));
  pending.set(backend, operation);
  const clear = (): void => {
    if (pending.get(backend) === operation) pending.delete(backend);
  };
  void operation.then(clear, clear);
  return operation;
}

async function operate(backend: string, action: 'get' | 'set' | 'delete', key?: string): Promise<string | null> {
  if (!BACKEND_ID.test(backend)) throw new BackendError('bad_request', 'APIキーを保存できないバックエンドです。');
  if (process.platform !== 'win32') {
    if (action === 'get') return null;
    throw new BackendError('unsupported_permission', 'APIキーの安全な保存は現在Windowsのみ対応しています。');
  }
  return new Promise<string | null>((resolve, reject) => {
    const fail = (): void => reject(new BackendError('auth', STORE_FAILURE));
    const executable = join(
      process.env.SystemRoot ?? 'C:\\Windows',
      'System32',
      'WindowsPowerShell',
      'v1.0',
      'powershell.exe',
    );
    const child = spawn(executable, ['-NoProfile', '-NonInteractive', '-Command', WINDOWS_CREDENTIAL_SCRIPT], {
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let output = '';
    const timer = setTimeout(() => {
      child.kill();
      fail();
    }, 15000);
    child.on('error', fail);
    child.stdin.on('error', fail);
    child.stderr.resume(); // Never log helper output: failures may contain input.
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => {
      output += chunk;
      if (output.length > 16000) {
        child.kill();
        fail();
      }
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        fail();
        return;
      }
      try {
        const value: unknown = JSON.parse(output.replace(/^\uFEFF/, ''));
        if (value !== null && typeof value !== 'string') {
          fail();
          return;
        }
        resolve(value);
      } catch {
        fail();
      }
    });
    child.stdin.end(JSON.stringify({ backend, action, key }));
  }).catch(() => {
    throw new BackendError('auth', STORE_FAILURE);
  });
}

/** 保存したキーがあれば envVar に入れた環境変数（なければ、もとの環境変数のまま） */
export async function apiKeyEnvironment(
  backend: string,
  envVar: string,
  env: NodeJS.ProcessEnv = process.env,
): Promise<NodeJS.ProcessEnv> {
  const saved = await credentialStore(backend, 'get');
  return { ...env, [envVar]: saved ?? env[envVar] };
}

export async function manageApiKey(backend: string, envVar: string, action: KeyAction, key?: string): Promise<string> {
  if (action === 'set') {
    if (!key?.trim() || Buffer.byteLength(key.trim(), 'utf8') > 2560 || /[\r\n\0]/.test(key)) {
      throw new BackendError('bad_request', 'APIキーを1行・2560バイト以内で入力してください。');
    }
    await credentialStore(backend, 'set', key.trim());
  } else if (action === 'delete') await credentialStore(backend, 'delete');
  const saved = await credentialStore(backend, 'get');
  const source = saved !== null ? 'saved' : process.env[envVar]?.trim() ? 'environment' : 'unset';
  return JSON.stringify({ source, supported: process.platform === 'win32' });
}
