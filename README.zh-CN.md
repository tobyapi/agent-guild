# AI 公会

[English](README.md) | [日本語](README.ja.md) | **简体中文** | [繁體中文](README.zh-TW.md) | [한국어](README.ko.md)

一款让人类与 AI 智能体在频道中边对话边协作的桌面应用。
可以把 Claude、Codex、Ollama、DeepSeek、Gemini 等模型登记为“伙伴”，在类似 Slack 的频道里呼叫它们或给它们分派工作。

> 更新到 v1.0.3 后，现有的经理平时也会用简短、易懂的话回答。请它“详细说说”时，只有那一条回复会变得详细。[v1.0.3 的变更内容](docs/releases/v1.0.3.md)（日语）
>
> 从 v0.1.28 更新时，首次启动会先备份数据库再进行转换。使用更早版本的用户，请先用 v0.1.28 打开一次同一个数据文件夹。[更新步骤与备份位置](docs/releases/v1.0.0.md)（日语）

图鉴头像使用的 ZipZipPipe 插画不适用 MIT 许可证。

## 功能

- **在频道中对话**：用 `@名字` 呼叫，对应的智能体就会回答。没有提及任何人的消息由谁来回答，可以按智能体分别设置。
- **创建智能体**。设置名字、头像、职责、性格、语气、擅长领域，以及要使用的后端和模型。可从“执行者、创意者、专家、经理”4 种角色中选择。先从 1 名执行者开始，需要时再添加伙伴。
- **权限由角色决定**：无需操作单独的开关。执行者可使用后端支持的全部功能；创意者、专家、经理以工作区内的操作为基础，并根据所用后端自动调整。
- **咨询与分派**：执行者一边调查一边推进制作和确认，需要时可以请创意者出主意、请专家做评估。经理判断是否需要分工，并核实、汇总结果。
- **频道运行统计**。从频道右上角可查看过去的分派记录和结果报告率。新的运行会按模型汇总用时、已获取的令牌数和估算的 API 费用。
- **适合角色的内置技能**：创建智能体或变更角色时，创意者会获得转换思路、自省的指南，专家会获得协作、评审的指南，经理会获得分派工作与汇总结果、复盘、按听众调整讲解（ELI5）的指南。专家的协作规则即使从技能栏中移除，只要仍是专家，每次都会生效。
- **技能**：可以用 Agent Skills（`SKILL.md`）格式为智能体提供指南，也可以从本地的技能文件夹中添加。
- **主动行动**：按设定的间隔，智能体会主动进行调查或提出建议。
- **记忆**：在每个智能体的工作区里的 `MEMORY.md` 中留下供下次使用的备忘。

## 正文的排版语法

在聊天中写下 `[操作手册](<D:/资料/工作 手册.md>)` 这样的内容，点击“操作手册”即可用默认应用打开阅读。按住 Shift 点击则在文件夹中显示。

除 Markdown 外，还可以像下面这样对聊天正文的一部分进行排版。

- `:t[那个…]{color=red size=2.5 rotate=180 weight=bold}` — 颜色、字号（em 倍率）、旋转角度（度）、粗细。颜色可用 red 等基本色，或 `#rgb` / `#rrggbb`。
- `:chars[紧紧地]{bend=6 drift=0.3}` — 逐字改变角度和水平位置。也可以用 `rotate="0 5 10" dx="0 0.2 0.4" dy="0 0 0.2"` 单独指定。数值中角度以度为单位，位置以 em 为单位。
- `:path[弯曲]{d="M0,80 C100,20 200,20 300,80" size=1.4}` — 让文字沿 SVG 路径排列。
- 从 `:::layout{vertical rotate=-8}` 到 `:::` — 保留空格和换行，并停止自动换行。`vertical` 表示竖排。范围内也可以使用普通的强调和上面的语法。横排用 `:::layout{rotate=-8}`。

大小为 0.5～5，角度为 -360～360，逐字位移为 -20～20 em。超出范围的值或无效的语法会按原文显示。代码中不会解析。

## 准备工作

发行版内置了供运行器使用的 Node.js。请根据所用的后端做好准备。

DeepSeek 和 Gemini 需要在“设置 → 后端”中保存 API 密钥，然后在智能体中选择模型。Gemini 支持 Developer API。这两个后端的工具都是只读的，不支持图像、搜索、写入和命令执行。支持范围以及连接检查的含义请参阅 [DeepSeek / Gemini](docs/deepseek-gemini.md)（日语）。

- Claude：[Claude Code](https://code.claude.com/docs/zh-CN/quickstart)。在 macOS 上可通过“设置 → 后端 → Claude”完成设置，必要时可在 Claude Code 打开的浏览器中登录。
- Codex：[Codex CLI](https://learn.chatgpt.com/docs/codex/cli#install-codex)。在 macOS 上可通过“设置 → 后端 → Codex”完成设置，必要时可在浏览器中登录 ChatGPT。在其他操作系统上，可在同一界面打开操作步骤。
- **Ollama**。在“添加智能体”中选择 **Ollama（本机）**，即可选择 Gemma、DeepSeek 等已安装的对话模型。在 Mac 上如果 Ollama 处于停止状态，按下 **启动 Ollama** 后模型列表会自动更新。支持图像的模型还可以接收附加的图片。刚添加模型后，可以通过“设置 → 后端 → 全部重新检查”更新列表。[Ollama](https://ollama.com/)

Claude 和 Codex 的使用费用由各自服务的账号承担。

## 运行

安装程序（Windows x64、macOS Apple Silicon）可从 [GitHub 的 Releases](https://github.com/tobyapi/agent-guild/releases) 免费下载。也可以从源代码构建运行。

构建需要 Node.js 24、[Rust](https://www.rust-lang.org/)（1.89 及以上）以及 [Tauri 的前置依赖](https://tauri.app/start/prerequisites/)（Windows 上为 WebView2 和 Visual Studio Build Tools，macOS 上为 Xcode Command Line Tools）。

```bash
npm install
npm run app
```

首次启动时，会弹出对话框让你设置名字、技能文件夹和数据的保存位置（之后都可以在设置中更改）。大厅（名为“ロビー”）里有 1 名执行者“ミナト”。在“设置 → 后端”中准备好 Codex 后，就可以和它对话了。

### 命令

| 命令 | 说明 |
|---|---|
| `npm run app` | 以开发模式启动应用 |
| `npm run dev` | 只在浏览器中启动界面（后端为模拟。`?mockSetup=1` 显示初始设置，`?mockDemo=1` 显示示例对话，`?mockBoot=missing` 显示恢复界面） |
| `npm run bundle` | 构建用于分发的应用和安装程序 |
| `npm run format` | 格式化代码（TS、CSS 用 Prettier，Rust 用 cargo fmt） |
| `npm run check` | 一次性运行格式检查、类型检查、lint、可维护性检查、测试、clippy 和 Rust 测试 |

通过 GitHub Actions（[.github/workflows/build.yml](.github/workflows/build.yml)）可以构建 Windows（x64）和 macOS（Apple Silicon）的安装程序（手动运行或推送 `v*` 标签时触发）。标签构建还会生成自动更新用的签名和 `latest.json`，并附加到草稿版 Release 中。发布 Release 后，已分发的应用就会发现新版本（原理和步骤见 [docs/design.md](docs/design.md)（日语）中的“アプリの更新”（应用更新））。`npm run check` 在每次推送到 main 和每个拉取请求时，也会在 GitHub Actions（[.github/workflows/check.yml](.github/workflows/check.yml)）上运行。

在本地只选择与改动相关的测试、类型检查和 lint。仅修改文档时，检查差异即可。完整检查原则上交给 CI，在大范围改动等必要时再执行。详情请参阅 [CLAUDE.md](CLAUDE.md)（日语）中的“ローカルでの検証”（本地验证）。

## 关于安全

智能体在你的电脑上以与你相同的权限运行。请只授予所委托工作必需的权限。

- 权限按后端以能够可靠执行的方式实现（无法保证的组合不能保存）。
- “运行命令”“写入工作区以外的位置”是也能删除文件、向外部发送数据的强权限。编辑界面会给出提示。
- 为防范混在网页或文件中的指令（提示注入），会告诉智能体如何对待资料，并对可能读取文件后向外发送的权限组合发出警告。名称看起来像机密的环境变量不会传给命令。Claude 智能体在执行命令或打开网页之前，会用小模型确认是否符合请求，可疑时会停止。
- 这些机制用于减少损害，并不能完全防止。处理重要数据或机密时，请使用权限受限的智能体。

## 数据的保存位置

频道、智能体、对话和工作区保存在数据文件夹中（默认是应用的数据位置，可在设置中更改）。每台机器的设置（数据文件夹的位置、技能文件夹）保存在操作系统的应用设置位置下的 `settings.json` 中。

## 面向开发者

- 规格、IPC 契约、运行方式、数据文件夹：[docs/design.md](docs/design.md)（日语）
- 代码结构与扩展方法：[docs/architecture.md](docs/architecture.md)（日语）
- 视觉设计指南：[docs/ui-design.md](docs/ui-design.md)（日语）
- 开发方针与可维护性检查：[CLAUDE.md](CLAUDE.md)（日语）

整体由三部分构成：React（界面）、Rust / Tauri（应用主体）、agent-runner（在各后端上运行智能体的 Node 进程）。

## Code signing policy

Windows 安装程序的代码签名正在申请 [SignPath Foundation](https://signpath.org/) 的免费计划。获得批准之前不进行签名。签名的对象与方式、负责人以及隐私方针汇总在 [Code signing policy](CODE_SIGNING_POLICY.md) 中（英语）。配置与步骤见 [docs/code-signing.md](docs/code-signing.md)（日语）。

## 隐私（Privacy policy）

除用户主动要求外，本应用不会向网络上的其他系统发送信息。例外如下（英语全文见 [Code signing policy](CODE_SIGNING_POLICY.md#privacy-policy)）。

- **检查更新**：启动时、返回应用或恢复连接时，以及每 5 分钟，从 GitHub 的 Releases（`https://github.com/tobyapi/agent-guild/releases/latest/download/latest.json`）确认是否有新版本。只发送普通的 HTTPS 请求，不会发送对话或文件的内容。在“设置 → 应用更新”中关闭“自动检查新版本”后，只在按下［检查更新］时才确认。
- **AI 后端**：向智能体发送消息时，会把对话交给为该智能体设置的后端（Claude Code、Codex CLI、Ollama 等）。发送目标和数据处理遵循各服务的隐私政策。Ollama（本机）不会发送到设备之外。
- **角色图鉴**：只有在打开图鉴的选择界面时，才会从图鉴的网站获取图片。

## 许可证

软件采用 [MIT](LICENSE) 许可证。参与时请遵守 [行为准则（Code of Conduct）](CODE_OF_CONDUCT.md)（英语）。Windows 版附带了用于隔离运行命令的 Microsoft 可执行文件（[MXC](https://github.com/microsoft/mxc) 的 `wxc-exec.exe`，MIT）。

## 致谢

智能体的“角色图鉴”参考了 Gender Swap AI 的角色图鉴。感谢发布角色插画的 ZipZipPipe，以及创作了 DeepSeek 原角色的上善无形。[AI 拟人化角色图鉴](https://genderswapai.com/zh-CN/ai-gijinka) · [ZipZipPipe](https://space.bilibili.com/4168597/dynamic)

应用从[角色图鉴](https://genderswapai.com/zh-CN/ai-gijinka)获取图片。智能体头像裁剪为正方形，图鉴吉祥物在本机移除全身图片的背景，JEV 保留原有透明背景。所选图片保存在本机。

图鉴角色图片不适用应用的 MIT 许可证，不得商用。[ZipZipPipe 的使用条件](https://www.pixiv.net/artworks/148186519)要求注明作者。DeepSeek 署名上善无形和 ZipZipPipe，适用 [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/)。未找到 JEV 的使用条件说明。本应用对其采用与其他角色相同的规则：须注明作者，不可商用。作者、原帖及修改内容见**设置 → 应用 → 许可声明**。
