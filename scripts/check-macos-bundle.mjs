// 署名済みの .app に入っている Node.js とランナーだけで、起動時の ready が届くことを確かめる。
import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createInterface } from 'node:readline';

const app = resolve(process.argv[2]);
execFileSync('/usr/bin/codesign', ['--verify', '--deep', '--strict', app], { stdio: 'inherit' });

const home = mkdtempSync(join(tmpdir(), 'guild-bundle-check-'));
try {
  const node = join(app, 'Contents', 'MacOS', 'guild-node');
  const cwd = join(app, 'Contents', 'Resources', 'runner');
  const script = join(cwd, 'agent-runner', 'src', 'main.js');
  const runner = spawn(node, [script], {
    cwd,
    env: { PATH: '/usr/bin:/bin', HOME: home },
    stdio: ['pipe', 'pipe', 'inherit'],
    timeout: 20_000,
  });
  const lines = createInterface({ input: runner.stdout });
  const exited = once(runner, 'exit');
  const [line] = await Promise.race([
    exited.then(([exitCode, signal]) => {
      throw new Error(`ready の前にランナーが終了しました (${exitCode ?? signal})`);
    }),
    once(lines, 'line'),
  ]);
  lines.close();
  runner.stdin.end();
  const [code] = await exited;
  assert.equal(JSON.parse(line).type, 'ready');
  assert.equal(code, 0);
  console.log('同梱のランナーから ready を受信しました');
} finally {
  rmSync(home, { recursive: true, force: true });
}
