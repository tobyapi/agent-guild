# Code signing policy

This project builds its release artifacts on GitHub Actions from this public repository and publishes them on GitHub Releases. The signing method differs by platform.

## Windows — SignPath Foundation (pending)

We are applying to the [SignPath Foundation](https://signpath.org/) program.

Statement required by the program, effective once approved:
"Free code signing provided by [SignPath.io](https://about.signpath.io/), certificate by [SignPath Foundation](https://signpath.org/)"

Status: pending approval. Until then, Windows installers are not code-signed.

### What will be signed

- The Windows installer (`agent-guild_windows-x64_<version>_x64-setup.exe`) published on GitHub Releases.
- The application executable inside the installer is not signed separately. Bundled third-party binaries (Node.js and Microsoft's `wxc-exec.exe`) keep their upstream signatures.

### Build and signing process

- Artifacts are built by the public workflow [`.github/workflows/build.yml`](.github/workflows/build.yml) on GitHub-hosted runners.
- Only artifacts built by that workflow are submitted to SignPath. SignPath verifies the origin (repository, workflow and commit) with GitHub.
- Release builds (tags `v*`) use the release signing policy, and every signing request requires manual approval. Manually triggered builds use the test signing policy.
- The private key is held by SignPath in a hardware security module. This project never stores it.
- Signing is restricted to files whose product name is `agent-guild` and whose product version matches the app version ([`.signpath/artifact-configuration.xml`](.signpath/artifact-configuration.xml)).

### Team roles

This is a single-maintainer project. All members use multi-factor authentication for GitHub and SignPath.

- Authors (commit access, can modify the repository without additional review):
  - [tobyapi](https://github.com/tobyapi)
- Reviewers (review changes proposed by non-committers, such as pull requests):
  - [tobyapi](https://github.com/tobyapi)
  - Policy: every external pull request is reviewed by the maintainer before merge.
- Approvers (approve each signing request):
  - [tobyapi](https://github.com/tobyapi)
  - Policy: every release signing request requires explicit approval by the maintainer.

## macOS

Not code-signed with an Apple Developer ID yet (ad-hoc signature only), so macOS shows a warning on first launch.

## Updates

Update packages are additionally signed with the project's update key (minisign) and verified by the app before installing. This is separate from OS code signing.

## Distribution locations

- <https://github.com/tobyapi/agent-guild/releases>

## Privacy policy

This program will not transfer any information to other networked systems unless specifically requested by the user or the person installing or operating it, with the following exceptions:

- **Update check**: on startup and every six hours, the app requests `https://github.com/tobyapi/agent-guild/releases/latest/download/latest.json` to see whether a newer version exists. Only a plain HTTPS request is sent; no conversations or files are included. You can turn this off in Settings → App updates ("Check for new versions automatically"); the app then checks only when you press "Check for updates".
- **AI backends**: when you talk to an agent, the conversation is sent to the backend you configured for that agent (Claude Code, Codex CLI, Ollama and others). Those services' privacy policies apply. Ollama running on your own computer does not send data off the machine.
- **Character gallery**: images are downloaded from the gallery site only when you open the selection screen.
