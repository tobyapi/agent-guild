# Grok direct runner: blocked boundary preflight

Date: 2026-11-16. Base: `7ee5b2ca2c85df787203cd965f09ae80422c9ba1`.

The direct runner has **not** been implemented. Work stopped at the user's explicit
sentinel-change condition during the first Windows command boundary experiment.
No xAI calls were made. No existing backend behavior or permissions were changed.

## Observed result

- Windows version reported by .NET: `10.0.26200.0`; Node: `v25.2.1`.
- Existing `@microsoft/mxc-sdk`: `1.0.1`.
- `prepareCommandSandbox()` returned `true` using the existing MXC probe criteria.
- A synthetic external sentinel and a workspace alias were created by the test
  harness before starting the container. Both names referenced the same file;
  `stat(alias).nlink` was `2`.
- Scope: writable workspace only, no extra readable directories, dedicated home
  under the test's state directory. Existing `runInSandbox` network policy applied.
- A command inside MXC wrote to the workspace alias and returned `exit=0`.
- The external sentinel changed from `GROK-BOUNDARY-SENTINEL-BEFORE` to
  `GROK-BOUNDARY-CHANGED`.

Only synthetic task-owned files were changed. The result is a failure of the
proposed command containment requirement, not a successful boundary test.

## Reproduction

The following Node module uses the unmodified base implementation. Run it with
Node's TypeScript support from a task-owned directory on Windows. It deliberately
creates and modifies its own synthetic sentinel and retains the fixture. It does
not read credentials, call a provider, or touch user files.

```javascript
import { mkdir, mkdtemp, writeFile, readFile, link, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { prepareCommandSandbox, runInSandbox } from
  'file:///D:/agent-guild/agent-runner/src/backends/command-sandbox.ts';

const root = await mkdtemp(join(tmpdir(), 'grok-boundary-preflight-'));
const workspace = join(root, 'work');
const outside = join(root, 'outside');
const stateDir = join(root, 'state');
for (const dir of [workspace, outside, stateDir]) await mkdir(dir);
const sentinel = join(outside, 'sentinel.txt');
const alias = join(workspace, 'alias.txt');
await writeFile(sentinel, 'GROK-BOUNDARY-SENTINEL-BEFORE');
await link(sentinel, alias);
const before = await readFile(sentinel, 'utf8');
const nlink = (await stat(alias)).nlink;
const available = await prepareCommandSandbox();
let commandResult;
if (available) {
  commandResult = await runInSandbox(
    { cwd: workspace, writable: [workspace], readable: [], home: join(stateDir, 'home') },
    "[IO.File]::WriteAllText((Join-Path (Get-Location) 'alias.txt'), 'GROK-BOUNDARY-CHANGED')",
    { signal: AbortSignal.timeout(60000), timeoutMs: 30000, outputLimit: 32768, stateDir },
  );
}
const after = await readFile(sentinel, 'utf8');
console.log({ root, available, nlink, commandResult, before, after, sentinelUnchanged: before === after });
```

The actual first run used the same operations in a fixed fresh directory under
the researcher's workspace, on drive D. The script and machine-readable result
are retained outside this repository:

- `D:/agent-guild-data/agents/717d11c3-6573-4b32-b960-58ed06e589d6/work/grok-boundary-preflight.mjs`
- `D:/agent-guild-data/agents/717d11c3-6573-4b32-b960-58ed06e589d6/work/grok-boundary-preflight/result.json`

## Implication and review scope

This demonstrates that granting a workspace path in the existing container policy
does not by itself protect an external file that already has a hardlink alias in
that workspace. It does not establish whether creating a new hardlink from inside
the container is possible. A fixed file helper's `nlink` validation was not part of
this command experiment; a helper has not been built or tested.

Adding `nlink` checks only to file tools would not reject this arbitrary command's
write. A preflight scan alone would also need a separate argument about concurrent
changes. The required next decision is how to enforce the command boundary against
this observed case before continuing the direct runner implementation. No weaker
policy or host-write fallback has been adopted.

Review the base `agent-runner/src/backends/command-sandbox/policy.ts`
(`containerConfig`), `command-sandbox.ts` (`runInSandbox`,
`runCommandLineInSandbox`), and `command-sandbox/role-command.ts`
(`runRoleCommand`). The new direct runner does not exist, so there is no new
capability declaration to approve. Other existing consumers of this shared sandbox
may warrant a separate review; this checkpoint does not change them.

## Validation limits

Design section 6.3's hardlink command case failed. All other attack cases, fixed
file helper/MEMORY operations, the direct API loop, section 6.1/6.2/6.4–6.7 fixtures,
and live integration remain unimplemented or untested. No full `check` run was made
for this documentation-only stop checkpoint. It is not a completed feature.
