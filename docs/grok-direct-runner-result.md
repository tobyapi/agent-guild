# Grok direct runner B: implementation and verification

2026-11-16, 白竜。Search/read-only implementation is committed on `feat/grok-direct-runner` in `D:/agent-guild-grok-direct`. Main integration is prohibited until Muse security review. This report supersedes the earlier stop report for B; the shared-isolation hardlink failure remains valid and belongs to C.

## Commits and scope

- Base main: `7ee5b2ca2c85df787203cd965f09ae80422c9ba1`; preflight stop documentation: `8c71110`.
- `8109442`: preserve WIP after exact-key and encrypted-state scan.
- `3f959c4`: completed fetch/replay/read-only fixtures, integration fixtures and credential-error sanitization.
- `7f4bd92`, `21cb8a1`: B acceptance criteria and direct-runner documentation.
- `4bc22eb`, `6aeac17`: DNS waiting is bounded by the whole-fetch cancellation/deadline signal; non-Error rejection reasons are normalized.
- `f7e0c50`, `3ef62b4`: explicit zero-result/three-search/over-budget cases, cancellation stages, real Windows identity swaps and cancelled skill/file reads.
- No checkout/reset/ff in `D:/agent-guild`, no push/tag/release. No shared sandbox behavior or command consumer changed. The Claude secret-roots module only re-exports an identical shared list, verified by existing tests.
- No database migration or stored role-grant edit. Existing Grok agents are restricted by the runtime capability intersection.

## Evidence by acceptance gate

| Gate | Implementation and evidence | Status / limits |
| --- | --- | --- |
| 6.1 | `grok.test.ts`: `Grok direct read-only contract`, 256 grant combinations each for win32/darwin/linux; absent write/command/MEMORY definitions, forged calls rejected and execution permissions rechecked. `usable-permissions.test.ts`, `contracts/behavior/role-permissions.json`, `contracts/ipc/snapshot.json` cover shared contracts. `unrestricted=[]`, four leak-risk pairs, unchanged requested permissionRules. | TS fixtures pass. OS declarations are simulations, not macOS/Linux filesystem evidence. Rust shared contract tests pass in the full check below. |
| 6.2 | `usage.ts` keeps provider ticks integral and includes server tool totals once. `response.test.ts`: provider total/cached/server tools, zero results with token cost and one/three Web calls, invalid/missing cost. `loop.test.ts`: next-request stop at 12 and 13 ticks against a 12-tick budget after a local call. Five-language catalog descriptions disclose $0.20 next-request threshold and in-flight overrun. | Added missing fixture variants PASS. Strict in-flight cap is not provided. |
| 6.3 B | All OS capability fixtures disable writeFiles/writeAnywhere/runCommands, with no MEMORY exception. `read.test.ts`: normal single-link read, secret hardlink rejection, management junction rejection, file-symlink rejection, workspace restriction, byte limit and cancellation. `read-race.test.ts`: real synthetic Windows renames at open/read seams; identity swaps before/after open reject before reading, a swap during read returns only approved handle bytes. | Windows link and deterministic identity-swap fixtures PASS. Hooks control scheduling; they do not replace real filesystem operations. No shared isolation attack tests. No real macOS/Linux filesystem run. |
| 6.4 | `fetch-url.test.ts` (29 cases): public socket address pinned without second lookup; mixed public/private DNS rejected; public-to-private redirect rejected; URL credentials/control/scheme and IPv4/IPv6 variants rejected; infinite redirects, streamed size, compression rejection, cancellation, stalled body and stalled DNS at the 15-second deadline. Late DNS success/failure after cancellation opens no socket and produces no unhandled rejection. `response.test.ts` covers absent/duplicate/invalid/zero-position citations. | DNS defect FIXED; deadline fixtures PASS using a controlled clock. The underlying OS lookup is not cancelled, but the request stops waiting and consumes its eventual settlement. Compressed responses are rejected. The local fetch policy does not establish xAI server-search destination restrictions. Titles and visited-versus-cited source distinction are not retained as structured output. |
| 6.5 | `loop.test.ts`: encrypted replay/state, duplicate/conflicting IDs and no retry. `cancellation.test.ts`: 18 before/during/after cases for read_file/fetch_url/read_skill/post dispatch and Web/X transport, plus four pre-cancelled actual tool dispatches. `read-race.test.ts`: actual read_file/read_skill discard bytes when cancelled during handle read. `fetch-url.test.ts`: actual fetch cancellation before/during response and DNS. `grok.test.ts`: forged write/command/MEMORY/server names rejected. History/ledger are job-local and cleared in finally. | Added cancellation/identity fixtures PASS. The 18-stage matrix injects executor/transport seams; it does not claim six live tool cancellations. Post and inline skill access are synchronous, so there is no separately interruptible I/O interval inside them. Completed posts are not rolled back. stream=false; no restart recovery or live streaming mode. |
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

Previous continuation check: EXIT 0; harness 44/44, TS violations 0; Vitest 1542 pass, 20 skipped; Rust 466 pass. This is historical evidence, not a check of the DNS fix.

This continuation's first full check: EXIT 1; format/typecheck/lint/harness passed, Vitest 1559 passed and 36 skipped, four GUI suites failed in their existing `beforeAll(bootApp)` hooks at 10000 ms (`App.agents`, `App.channels`, `App.frames`, `App.guild`). Rust stages were not reached. Log and exit: `grok-direct-check-workers4-attempt1.log` / `grok-direct-check-workers4-attempt1-exit.txt`. Source/test edits and focused verification overlapped the first run. No GUI code, timeout or assertion was changed. A second full workers-four run uses the fixed source at `3ef62b4` without concurrent source edits or focused tests; its result is recorded below when complete.

Second and final full check: **EXIT 0**. Formatting, typecheck, lint, TS harness (0 violations), harness 44/44, Vitest **1575 passed / 20 skipped**, files **197 passed / 1 skipped**, Rust clippy and Rust tests **466 passed / 0 failed**. The four initially timed-out GUI suites all passed without modification. Skips are not counted as PASS. Documentation was finalized afterward and separately checked with Prettier and git diff --check. The primary log/exit sidecar contain this completed run; attempt1 artifacts retain the failure.

## Key scan

Historical WIP scan: 28 files; prior continuation scan: 42 files. Both had exact credential matches 0, unreadable 0 and suspicious long encrypted/key patterns 0. This continuation expands the scan to the new fixtures, both full-check attempt logs and exit sidecars, changed implementation/docs since 8c71110, scripts/results/design and both report copies. The final work-directory `grok-direct-current-scan.json` is refreshed after the full check and report updates; an in-progress log scan is not treated as final evidence.

Final scan: **47 files**, exact credential matches **0**, unreadable **0**, suspicious long encrypted/key patterns **0**. Exact-byte absence does not establish absence of every transformed secret.

## Outstanding review and non-PASS items

Security acceptance is **not yet complete**. Muse review is required. The specific missing fixture variants above, other-OS real filesystem behavior, GUI checks and unperformed live cases are not counted as PASS. The B stop conditions have not been observed: encrypted replay succeeds, tested read exclusions hold, spend is below cap, and no shared sandbox change was required. Keep all changes on this branch for review; do not integrate main.

The previously reported stalled-DNS defect is fixed in this continuation. All requested missing fixture families now have explicit evidence above. No new live request or shared isolation change was needed. This is ready for Muse's source/security review, not permission to merge. Real macOS/Linux filesystem behavior, GUI, unperformed live cases and the structured-source limitations remain non-PASS as listed above.
