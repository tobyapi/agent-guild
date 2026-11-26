# AI Guild

**English** | [日本語](README.ja.md) | [简体中文](README.zh-CN.md) | [繁體中文](README.zh-TW.md) | [한국어](README.ko.md)

AI Guild is a desktop app where you and AI agents work together in chat channels.
Add models such as Claude, Codex, Ollama, DeepSeek, and Gemini as teammates. In a Slack-like channel, you can call on a teammate or assign it work.

> After you update to v1.0.3, your existing managers give short, plain answers by default. Ask for "more detail" when you want a fuller explanation for that reply. [What's new in v1.0.3](docs/releases/v1.0.3.md) (Japanese)
>
> On the first launch after an update from v0.1.28, the app backs up your database and converts it. If you use an older version, open the same data folder once with v0.1.28 before updating. [Update steps and backup location](docs/releases/v1.0.0.md) (Japanese)

Avatar illustrations from the AI Gijinka character gallery are by ZipZipPipe and are excluded from the MIT license.

## Features

- **Talk in channels.** Mention an agent with `@name` to get a reply. For each agent, you can choose whether it responds to messages without a mention.
- **Create agents.** Choose a name, avatar, role, personality, tone, and area of expertise for each agent, along with its backend and model. The four roles are Worker, Ideator, Expert, and Manager. Start with a single worker and add teammates as needed.
- **Permissions by role.** The app sets permissions for you based on the role and backend. Workers can use all the features their backend supports. Ideators, experts, and managers work mainly within their own workspace.
- **Consult and delegate.** Workers do the research, make things, and check their work. They can ask an ideator for ideas or an expert for a review. Managers decide whether to split up a task, then check and combine the results.
- **Review channel usage.** Open the statistics at the top right of a channel to see past delegations and how often agents reported back. For new runs, you can see total time, available token counts, and estimated API costs by model.
- **Use built-in skills by role.** When you create an agent or change its role, ideators get guides to shifting perspective and introspection. Experts get guides to collaboration and critique. Managers get guides to delegating work, combining results, running retrospectives, and explaining things to suit the listener (ELI5). Experts follow the collaboration rules on every run, even if you remove the guide from their skills list.
- **Skills**: Give agents guides in the Agent Skills (`SKILL.md`) format. You can also add them from your local skill folders.
- **Schedule independent work.** Set how often agents do research or make proposals on their own.
- **Memory**: Each agent leaves notes for next time in `MEMORY.md` in its own workspace.

## Formatting syntax for message text

Type a link such as `[Procedure](<D:/Docs/Work procedure.md>)` in chat. Click Procedure to open the file in its default app, or Shift+click to show it in its folder.

You can use Markdown in chat and apply these formats to part of a message.

- `:t[ummm]{color=red size=2.5 rotate=180 weight=bold}` sets the color, font size (em multiplier), rotation (degrees), and weight. Use a basic color name such as red, or a hex value in `#rgb` / `#rrggbb` format.
- `:chars[squeeze]{bend=6 drift=0.3}` varies the angle and horizontal position of each character. Use `rotate="0 5 10" dx="0 0.2 0.4" dy="0 0 0.2"` to set individual angles in degrees and offsets in em.
- `:path[curving]{d="M0,80 C100,20 200,20 300,80" size=1.4}` places text along an SVG path.
- Use `:::layout{vertical rotate=-8}` through `:::` to preserve spaces and line breaks and turn off wrapping. Use `vertical` for vertical writing. You can use emphasis and the formats above inside the block. For horizontal writing, use `:::layout{rotate=-8}`.

Use a size of 0.5–5, an angle of -360 to 360, and a per-character offset of -20–20 em. The app displays out-of-range values and invalid syntax as plain text. Formatting syntax inside code stays literal.

## Requirements

The packaged app includes Node.js for the runner. Follow the setup instructions for the backend you want to use.

For DeepSeek or Gemini, save your API key in Settings → Backends and choose a model for your agent. Gemini uses the Developer API. Both backends offer read-only tools. Neither supports images, search, writing, or running commands. For supported features and what the connection check tests, see [DeepSeek / Gemini](docs/deepseek-gemini.md) (Japanese).

- Claude: [Claude Code](https://code.claude.com/docs/en/quickstart). On macOS, set it up in Settings → Backends → Claude, and if needed, sign in through the browser that Claude Code opens.
- Codex: [Codex CLI](https://learn.chatgpt.com/docs/codex/cli#install-codex). On macOS, set it up in Settings → Backends → Codex, and if needed, sign in to ChatGPT in the browser. On other OSes, the same screen opens the instructions.
- **Ollama**. Choose **Ollama (this PC)** in "Add agent" to pick from installed chat models such as Gemma and DeepSeek. On a Mac, if Ollama is stopped, press **Start Ollama** and the model list refreshes automatically. Models that support images can also receive attached images. Right after adding a model, you can refresh the list with Settings → Backends → Recheck all. [Ollama](https://ollama.com/)

Claude and Codex charge usage fees to your account with each service.

## Running

Download the free installer for Windows x64 or macOS Apple Silicon from [GitHub Releases](https://github.com/tobyapi/agent-guild/releases). You can also build and run the app from source.

Building requires Node.js 24, [Rust](https://www.rust-lang.org/) (1.89 or later), and the [Tauri prerequisites](https://tauri.app/start/prerequisites/) (WebView2 and Visual Studio Build Tools on Windows, Xcode Command Line Tools on macOS).

```bash
npm install
npm run app
```

On first launch, enter your name, choose your skill folders, and pick a location for your data. You can change these in Settings. The lobby ("ロビー") starts with one worker, ミナト. Set up Codex in Settings → Backends to talk to ミナト.

### Commands

| Command | Description |
|---|---|
| `npm run app` | Launch the app in development mode |
| `npm run dev` | Launch only the UI in a browser (backend is mocked; `?mockSetup=1` shows first-run setup, `?mockDemo=1` a sample conversation, `?mockBoot=missing` the recovery screen) |
| `npm run bundle` | Build the distributable app and installers |
| `npm run format` | Format the code (Prettier for TS and CSS, cargo fmt for Rust) |
| `npm run check` | Run the format check, type check, lint, maintainability checks, tests, clippy, and Rust tests together |

Use GitHub Actions ([.github/workflows/build.yml](.github/workflows/build.yml)) to build installers for Windows (x64) and macOS (Apple Silicon). Start the workflow by hand or push a `v*` tag. A tag build attaches the auto-update signatures and `latest.json` to a draft release. Publish the release so installed apps can find the update. See "アプリの更新" (App updates) in [docs/design.md](docs/design.md) (Japanese) for the steps and how updates work. GitHub Actions also runs `npm run check` on each push to main and each pull request ([.github/workflows/check.yml](.github/workflows/check.yml)).

On your machine, run the tests, type checks, and lint checks that cover your change. If you changed only documentation, review the diff. CI runs the full checks. Run them on your machine when needed, such as for a change that spans several parts of the app. See "ローカルでの検証" (Local verification) in [CLAUDE.md](CLAUDE.md) (Japanese).

## Safety

Agents run on your PC with the same permissions as you. Grant only the permissions needed for the work you hand over.

- Each backend enforces its own permission rules. You can save only combinations it can enforce.
- "Run commands" and "Write outside the workspace" can allow an agent to delete files or send data off your machine. The editor warns you about these permissions.
- To guard against instructions hidden in web pages or files (prompt injection), the app tells agents how to handle source material. It warns you about permission combinations that let an agent read files and send their contents out. It also keeps environment variables with secret-looking names out of commands. Before running a command or opening a web page, Claude agents use a small model to check the action against your request. They stop if the action looks suspicious.
- These safeguards can reduce the damage, but some risk remains. Use agents with limited permissions when working with important data or secrets.

## Where data is stored

The app saves channels, agents, conversations, and workspaces in your data folder. It uses the app’s data location by default. You can choose another folder in Settings. On each machine, the app records the data folder location and skill folders in `settings.json` in the operating system’s app settings directory.

## For developers

- Specification, IPC contracts, how runs work, and the data folder: [docs/design.md](docs/design.md) (Japanese)
- Code structure and how to extend it: [docs/architecture.md](docs/architecture.md) (Japanese)
- Visual design guidelines: [docs/ui-design.md](docs/ui-design.md) (Japanese)
- Development policy and maintainability checks: [CLAUDE.md](CLAUDE.md) (Japanese)

The app has three parts: React (the UI), Rust / Tauri (the app core), and agent-runner (the Node process that runs agents on each backend).

## Code signing policy

We applied to the [SignPath Foundation](https://signpath.org/) free code signing program for the Windows installer. The installer remains unsigned pending approval. The [Code signing policy](CODE_SIGNING_POLICY.md) (in English) covers what we sign, how we sign it, who handles signing, and our privacy policy. For setup instructions, see [docs/code-signing.md](docs/code-signing.md) (Japanese).

## Privacy policy

Apart from the cases below, the app sends information to other systems over the network only at your request. The [Code signing policy](CODE_SIGNING_POLICY.md#privacy-policy) has the full privacy policy in English.

- **Update checks**: On startup, when you return to the app or reconnect, and every five minutes, the app checks GitHub Releases (`https://github.com/tobyapi/agent-guild/releases/latest/download/latest.json`) for a new version. It sends only a normal HTTPS request and never sends the contents of conversations or files. If you turn off "Check for new versions automatically" in Settings → App updates, it checks only when you press [Check for updates].
- **AI backends.** When you talk to an agent, the app passes the conversation to the backend you chose for that agent (Claude Code, Codex CLI, Ollama, etc.). Each service’s privacy policy covers where the data goes and how the service handles it. Ollama (this PC) keeps all data on your device.
- **Character gallery.** The app fetches images from the gallery site only when you open the picker.

## License

The software is [MIT](LICENSE). When participating, please follow the [Code of Conduct](CODE_OF_CONDUCT.md). The Windows build bundles a Microsoft executable for running commands in isolation (`wxc-exec.exe` from [MXC](https://github.com/microsoft/mxc), MIT).

## Acknowledgments

The agents' "Character gallery" references the character gallery of Gender Swap AI. Thanks to ZipZipPipe, who publishes the character illustrations, and to 上善无形, who created the original DeepSeek character. [AI Gijinka character gallery](https://genderswapai.com/ai-gijinka) · [ZipZipPipe](https://space.bilibili.com/4168597/dynamic)

The app fetches illustrations from the [AI Gijinka character gallery](https://genderswapai.com/ai-gijinka). Agent avatars use square face crops. Gallery mascots use full-body images with the background removed locally. JEV keeps its original transparency. The chosen image is saved on your device.

Gallery character images are excluded from the app’s MIT license. Commercial use is prohibited. [ZipZipPipe’s terms](https://www.pixiv.net/artworks/148186519) require attribution. The DeepSeek illustration is by 上善无形 (original character) and ZipZipPipe (adaptation), licensed under [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/). No terms of use found for JEV. This app treats it like the other characters: attribution required, no commercial use. See **Settings → App → License notices** for credits, original posts, and changes.
