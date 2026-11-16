# Grok direct runner B: implementation and verification

2026-11-16, 白竜。Search/read-only implementation is committed on `feat/grok-direct-runner` in `D:/agent-guild-grok-direct`. Main integration is prohibited until Muse security review. This report supersedes the earlier stop report for B; the shared-isolation hardlink failure remains valid and belongs to C.

## Commits and scope

- Base main: `7ee5b2ca2c85df787203cd965f09ae80422c9ba1`; preflight stop documentation: `8c71110`.
- `8109442`: preserve WIP after exact-key and encrypted-state scan.
- `3f959c4`: completed fetch/replay/read-only fixtures, integration fixtures and credential-error sanitization.
- `7f4bd92`, `21cb8a1`: B acceptance criteria and direct-runner documentation.
- No checkout/reset/ff in `D:/agent-guild`, no push/tag/release. No shared sandbox behavior or command consumer changed. The Claude secret-roots module only re-exports an identical shared list, verified by existing tests.
- No database migration or stored role-grant edit. Existing Grok agents are restricted by the runtime capability intersection.

## Evidence by acceptance gate

| Gate | Implementation and evidence | Status / limits |
| --- | --- | --- |
| 6.1 | `grok.test.ts`: `Grok direct read-only contract`, 256 grant combinations each for win32/darwin/linux; absent write/command/MEMORY definitions, forged calls rejected and execution permissions rechecked. `usable-permissions.test.ts`, `contracts/behavior/role-permissions.json`, `contracts/ipc/snapshot.json` cover shared contracts. `unrestricted=[]`, four leak-risk pairs, unchanged requested permissionRules. | TS fixtures pass. OS declarations are simulations, not macOS/Linux filesystem evidence. Rust shared contract tests pass in the full check below. |
| 6.2 | `usage.ts` keeps provider ticks integral and includes server tool totals once. `response.test.ts`: `counts the provider total once including cached and server tool usage`, invalid/missing cost fails closed. `loop.test.ts`: `stops next request at the job budget and does not reset after a local call`. Five-language catalog descriptions disclose $0.20 next-request threshold and in-flight overrun. | Relevant fixtures pass. Strict in-flight cap is not provided. Explicit zero-result/Web-three-calls and greater-than-budget fixture variants are not separately implemented; do not count them as PASS. |
| 6.3 B | All OS capability fixtures disable writeFiles/writeAnywhere/runCommands, with no MEMORY exception. `read.test.ts`: normal single-link read, secret hardlink rejection, management junction rejection, file-symlink rejection, workspace restriction, byte limit and cancellation. Tests create real synthetic links on Windows, without running isolation probes. `read.ts` checks components, realpath, nlink and pre/open/post file identity, reads through retained handle. | Windows link fixtures pass. No shared isolation attack tests. No real macOS/Linux filesystem run or adversarial concurrent path-swap fixture. |
| 6.4 | `fetch-url.test.ts` (26 cases): public socket address pinned without second lookup; mixed public/private DNS rejected; public-to-private redirect rejected; URL credentials/control/scheme and IPv4/IPv6 variants rejected; infinite redirects, streamed size, compression rejection, cancellation, 15-second deadline. `response.test.ts` covers absent/duplicate/invalid/zero-position citations. | Fixtures pass; compressed responses are rejected rather than decompressed. The local fetch policy does not establish xAI server-search destination restrictions. Titles and visited-versus-cited source distinction are not retained as structured output. |
| 6.5 | `loop.test.ts`: encrypted-state replay and matching output retained, missing state stops execution, duplicate IDs reuse results, conflicts/empty IDs/custom/orphan output rejected, cancellation after HTTP stops local execution, interrupted local execution is not retried. `grok.test.ts`: forged write/command/MEMORY/server-function names rejected at execute. History/ledger are job-local and cleared in finally; no restart recovery. | Fixtures pass. Transport requests completed JSON with stream=false; unexpected SSE fails closed. No live streaming mode. Separate before/during/after-each-tool cancellation matrix and read-identity race fixture remain unimplemented. |
| 6.6 | `grok-run.test.ts`: canary absent from input, fixed endpoint Authorization only, 401/403/429/404/500 with reflected key sanitized, transport cancellation sanitized, credential-store failure stops without fallback. `grok-probe.test.ts` verifies reflected canary absent from status. Exact-key scans below cover current artifacts. | Fixtures pass. No subprocess path exists. Exact-byte absence does not prove absence of every possible secret or transformed key. |
| 6.7 | `integration.test.ts`: supplied skill and asset read, traversal/forged write rejected, host image encoded with model-selected reading disabled, unknown image model rejected, server search plus duplicate post and continuation, final duplicate suppression, onActivity/onUsage. `response.test.ts`: malformed JSON/unexpected SSE/incomplete response/missing usage/oversize rejected without retry. Live Web+read+continuation and X results below. | Fixtures and listed live cases pass. GUI end-to-end, image/skill/post live, remote skill-file asset integration, all malformed SSE-event variants, long duration and arbitrary model image support remain unverified. |

## Live evidence and spending

No additional live requests in this continuation: both saved result files were already completed before the prior turn timed out. Credentials and raw API/encrypted responses are not persisted by the test scripts.

| Artifact in the work directory | Requests | Observed result | Cost |
| --- | --- | --- | --- |
| `grok-direct-live-result.json` | 2 | Web calls 1; read_file 1; encrypted response items 3; replay requests 1; final includes official docs URL and `GROK-READ-CONTINUATION-FIXTURE`. | $0.02145 |
| `grok-direct-x-live-result.json` | 1 | X call 1, public posts fetched 1, final cites `https://x.com/gfodor/status/2122119837854150927`. | $0.016294 |
| Total B | 3 | Both searches have cited results; mixed local-function continuation succeeds. | **$0.037744**, below authorized $0.50 |

The X post URL was returned by the API; independent browsing of the post was not performed. Prior design-stage probes are separate historical spending, not these B test requests. The next-request budget is not a guarantee on the cost of a request already in flight.

## Full check (workers 4)

Command: `VITEST_MAX_WORKERS=4 CARGO_BUILD_JOBS=4 npm run check` (PowerShell environment variables). Log: work-directory `grok-direct-check-workers4.log` (PowerShell UTF-16). Exit sidecar: `grok-direct-check-workers4-exit.txt`.

Final check: **EXIT 0**. Formatting/typecheck/lint pass; harness 44/44, TS violations 0; Vitest 1542 pass, 20 skipped, files 195 pass and 1 skipped. Rust clippy passes (1m57s); Rust tests total 466 pass, 0 failures. Skipped Vitest cases are not PASS. Code was unchanged during this full check; documentation was updated afterward and separately passed Prettier and git diff --check.

## Key scan

Initial WIP scan: 28 files, exact credential matches 0, unreadable 0, suspicious long encrypted/key patterns 0 (`grok-direct-current-scan.json` at that checkpoint). The continuation scan covers 42 files: all implementation/docs changed since 8c71110, current scripts/results/design/report and the check log. Exact credential matches 0, unreadable 0, suspicious long encrypted/key patterns 0. The work-directory JSON is refreshed after report updates. A scan of a still-running check log covers its bytes at scan time only.

## Outstanding review and non-PASS items

Security acceptance is **not yet complete**. Muse review is required. The specific missing fixture variants above, other-OS real filesystem behavior, GUI checks and unperformed live cases are not counted as PASS. The B stop conditions have not been observed: encrypted replay succeeds, tested read exclusions hold, spend is below cap, and no shared sandbox change was required. Keep all changes on this branch for review; do not integrate main.

Final source inspection found a concrete remaining 6.4 defect: `hop()` awaits `dns.lookup()` before checking the bounded signal, so a stalled DNS lookup may delay rejection beyond 15 seconds. The current deadline fixture covers a stalled response body, not stalled DNS. Next continuation must bound DNS waiting with cancellation and add the stalled-DNS fixture before claiming the whole-fetch deadline gate passes. This is not a secret-read boundary failure and did not trigger a new live request.
