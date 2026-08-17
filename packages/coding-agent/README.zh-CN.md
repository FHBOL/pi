<p align="center">
  <a href="https://pi.dev">
    <img alt="pi logo" src="https://pi.dev/logo-auto.svg" width="128">
  </a>
</p>
<p align="center">
  <a href="https://discord.com/invite/3cU7Bz4UPx"><img alt="Discord" src="https://img.shields.io/badge/discord-community-5865F2?style=flat-square&logo=discord&logoColor=white" /></a>
  <a href="https://www.npmjs.com/package/@earendil-works/pi-coding-agent"><img alt="npm" src="https://img.shields.io/npm/v/@earendil-works/pi-coding-agent?style=flat-square" /></a>
</p>

> 新贡献者提交的新 issue 与 PR 默认会被自动关闭。维护者每天会审查被自动关闭的 issue。参见 [CONTRIBUTING.md](../../CONTRIBUTING.md)。

---

Pi 是一个精简的终端编程 harness。让 pi 适配你的工作流，而不是反过来，且无需 fork 并修改 pi 内部。通过 TypeScript [扩展（Extensions）](#扩展)、[Skills](#skills)、[提示模板（Prompt Templates）](#提示模板) 与 [主题（Themes）](#主题) 进行扩展。将扩展、skills、提示模板与主题放在 [Pi Packages](#pi-packages) 中，并通过 npm 或 git 与他人分享。

Pi 自带强大的默认配置，但跳过了子 agent 与 plan mode 等功能。你可以让 pi 构建你想要的功能，或安装符合你工作流的第三方 pi package。

Pi 有四种运行模式：交互式、print/JSON、用于进程集成的 RPC，以及用于嵌入自有应用的 SDK。

## 分享你的开源编程 agent 会话

如果你用 pi 做开源工作，请分享你的编程 agent 会话。

公开的 OSS 会话数据有助于基于真实开发工作流改进模型、提示、工具与评估。

完整说明见 [这篇 X 上的帖子](https://x.com/badlogicgames/status/2037811643774652911)。

要发布会话，请使用 [`badlogic/pi-share-hf`](https://github.com/badlogic/pi-share-hf)。阅读其 README.md 了解设置说明。你只需要一个 Hugging Face 账号、Hugging Face CLI，以及 `pi-share-hf`。

你也可以观看[这个视频](https://x.com/badlogicgames/status/2041151967695634619)，其中我展示了如何发布自己的 `pi-mono` 会话。

我定期将自己的 `pi-mono` 工作会话发布在这里：

- [badlogicgames/pi-mono on Hugging Face](https://huggingface.co/datasets/badlogicgames/pi-mono)

## 目录

- [快速开始](#快速开始)
- [提供商与模型](#提供商与模型)
- [交互模式](#交互模式)
  - [编辑器](#编辑器)
  - [命令](#命令)
  - [键盘快捷键](#键盘快捷键)
  - [消息队列](#消息队列)
- [会话](#会话)
  - [分支](#分支)
  - [压缩（Compaction）](#压缩compaction)
- [设置](#设置)
- [上下文文件](#上下文文件)
- [自定义](#自定义)
  - [提示模板](#提示模板)
  - [Skills](#skills)
  - [扩展](#扩展)
  - [主题](#主题)
  - [Pi Packages](#pi-packages)
- [编程式用法](#编程式用法)
- [设计理念](#设计理念)
- [CLI 参考](#cli-参考)

---

## 快速开始

```bash
npm install -g --ignore-scripts @earendil-works/pi-coding-agent
```

`--ignore-scripts` 会在安装期间禁用依赖的生命周期脚本。Pi 的正常 npm 安装不需要 install scripts。

安装器替代方案：

```bash
curl -fsSL https://pi.dev/install.sh | sh
```

使用 API key 进行认证：

```bash
export ANTHROPIC_API_KEY=sk-ant-...
pi
```

或使用你现有的订阅：

```bash
pi
/login  # Then select provider
```

然后直接与 pi 对话即可。默认情况下，pi 为模型提供四个工具：`read`、`write`、`edit` 与 `bash`。模型使用这些工具完成你的请求。通过 [skills](#skills)、[提示模板](#提示模板)、[扩展](#扩展) 或 [pi packages](#pi-packages) 增加能力。

**平台说明：** [Windows](docs/windows.md) | [Termux (Android)](docs/termux.md) | [tmux](docs/tmux.md) | [终端设置](docs/terminal-setup.md) | [Shell 别名](docs/shell-aliases.md)

---

## 提供商与模型

对每个内置提供商，pi 维护一份支持 tool calling 的模型列表。已配置的提供商目录会自动刷新；运行 `pi update --models` 可强制立即刷新。通过订阅（`/login`）或 API key 认证后，用 `/model`（或 Ctrl+L）从该提供商选择任意模型。

**订阅：**
- Anthropic Claude Pro/Max
- OpenAI ChatGPT Plus/Pro (Codex)
- GitHub Copilot

**API keys：**
- Anthropic
- Ant Ling
- OpenAI
- Azure OpenAI
- DeepSeek
- NVIDIA NIM
- Google Gemini
- Google Vertex
- Amazon Bedrock
- Mistral
- Groq
- Cerebras
- Cloudflare AI Gateway
- Cloudflare Workers AI
- xAI
- OpenRouter
- Vercel AI Gateway
- ZAI Coding Plan (Global)
- ZAI Coding Plan (China)
- OpenCode Zen
- OpenCode Go
- Hugging Face
- Fireworks
- Together AI
- Baseten
- Kimi For Coding
- MiniMax
- Xiaomi MiMo
- Xiaomi MiMo Token Plan (China)
- Xiaomi MiMo Token Plan (Amsterdam)
- Xiaomi MiMo Token Plan (Singapore)

Pi 也支持 llama.cpp router server。用 `/login llama.cpp` 配置，用 `/llama` 管理下载与已加载模型，再用 `/model` 选择已加载模型。设置与用法见 [docs/llama-cpp.md](docs/llama-cpp.md)。

其他提供商的设置说明见 [docs/providers.md](docs/providers.md)。

**自定义提供商与模型：** 若提供商使用受支持的 API（OpenAI、Anthropic、Google），可通过 `~/.pi/agent/models.json` 添加。对于自定义 API 或 OAuth，请使用扩展。参见 [docs/models.md](docs/models.md) 与 [docs/custom-provider.md](docs/custom-provider.md)。

---

## 交互模式

<p align="center"><img src="docs/images/interactive-mode.png" alt="Interactive Mode" width="600"></p>

界面自上而下：

- **启动标头** - 显示快捷键（`/hotkeys` 查看全部）、已加载的 AGENTS.md 文件、提示模板、skills 与扩展
- **消息** - 你的消息、助手回复、工具调用与结果、通知、错误，以及扩展 UI
- **编辑器** - 输入区域；边框颜色表示 thinking 级别
- **页脚** - 工作目录、会话名称、总 token/缓存用量（`↑` 输入、`↓` 输出、`R` 缓存读、`W` 缓存写、`CH` 最近缓存命中率）、费用、上下文用量、当前模型。总量包括助手回复、工具报告的用量，以及摘要生成。

编辑器可被其他 UI 临时替换，例如内置 `/settings`，或扩展提供的自定义 UI（例如让用户以结构化格式回答模型问题的 Q&A 工具）。[扩展](#扩展) 也可以替换编辑器、在其上方/下方添加 widget、状态行、自定义页脚或叠加层。

### 编辑器

| 功能 | 用法 |
|---------|-----|
| 文件引用 | 输入 `@` 对项目文件进行模糊搜索 |
| 路径补全 | Tab 补全路径 |
| 多行 | Shift+Enter（Windows Terminal 上为 Ctrl+Enter） |
| 外部编辑器 | Ctrl+G 打开 `externalEditor`、`$VISUAL`、`$EDITOR`、Windows 上的 Notepad，或其他平台上的 `nano` |
| 剪贴板 | Ctrl+V 粘贴图片或文本（Windows 上为 Alt+V），或将图片拖到终端 |
| Bash 命令 | `!command` 运行并将输出发送给 LLM，`!!command` 运行但不发送 |

删除单词、撤销等标准编辑快捷键见 [docs/keybindings.md](docs/keybindings.md)。

### 命令

在编辑器中输入 `/` 触发命令。[扩展](#扩展) 可注册自定义命令，[skills](#skills) 以 `/skill:name` 可用，[提示模板](#提示模板) 通过 `/templatename` 展开。

| 命令 | 说明 |
|---------|-------------|
| `/login`, `/logout` | 管理提供商凭证 |
| [`/llama`](docs/llama-cpp.md) | 下载、加载与卸载 llama.cpp router 模型 |
| `/model` | 切换模型 |
| `/scoped-models` | 启用/禁用用于 Ctrl+P 循环的模型 |
| `/settings` | Thinking 级别、主题、消息投递、传输 |
| `/resume` | 从以往会话中选择 |
| `/new` | 开始新会话 |
| `/name <name>` | 设置会话显示名称 |
| `/session` | 显示会话信息（文件、ID、消息、tokens、费用） |
| `/tree` | 跳转到会话中的任意点并从那里继续 |
| `/trust` | 保存项目信任决策供未来会话使用（需重启） |
| `/fork` | 从先前的用户消息创建新会话 |
| `/clone` | 将当前活动分支复制到新会话 |
| `/compact [prompt]` | 手动压缩上下文，可选自定义指令 |
| `/copy` | 将最后一条助手消息复制到剪贴板 |
| `/export [file]` | 将会话导出为 HTML 或 JSONL 文件 |
| `/import <file>` | 从 JSONL 文件导入并恢复会话 |
| `/share` | 上传为私有 GitHub gist，并提供可分享的 HTML 链接 |
| `/reload` | 重新加载快捷键、扩展、skills、提示、主题与上下文文件 |
| `/hotkeys` | 显示所有键盘快捷键 |
| `/changelog` | 显示版本历史 |
| `/quit` | 退出 pi |

### 键盘快捷键

完整列表见 `/hotkeys`。通过 `~/.pi/agent/keybindings.json` 自定义。参见 [docs/keybindings.md](docs/keybindings.md)。

**常用：**

| 按键 | 动作 |
|-----|--------|
| Ctrl+C | 清空编辑器 |
| Ctrl+C 两次 | 退出 |
| Escape | 取消/中止 |
| Escape 两次 | 打开 `/tree` |
| Ctrl+L | 打开模型选择器 |
| Ctrl+P / Shift+Ctrl+P | 向前/向后循环 scoped 模型 |
| Shift+Tab | 循环 thinking 级别 |
| Ctrl+O | 折叠/展开工具输出 |
| Ctrl+T | 折叠/展开 thinking 块 |
| Ctrl+X | 复制最后一条助手消息 |

### 消息队列

在 agent 工作时提交消息：

- **Enter** 将消息排入 *steering* 队列，在当前助手轮次完成其工具调用执行后投递
- **Alt+Enter** 将消息排入 *follow-up* 队列，仅在 agent 完成所有工作后投递
- **Escape** 中止并将排队消息恢复到编辑器
- **Alt+Up** 将排队消息取回到编辑器

在 Windows Terminal 上，`Alt+Enter` 默认是全屏。请在 [docs/terminal-setup.md](docs/terminal-setup.md) 中重新映射，以便 pi 能收到 follow-up 快捷键。

在[设置](docs/settings.md)中配置投递：`steeringMode` 与 `followUpMode` 可为 `"one-at-a-time"`（默认，等待响应）或 `"all"`（一次投递所有排队消息）。`transport` 为支持多种传输的提供商选择传输偏好（`"sse"`、`"websocket"` 或 `"auto"`）。

---

## 会话

会话以具有树结构的 JSONL 文件存储。每条记录有 `id` 与 `parentId`，支持原地分支而无需创建新文件。文件格式见 [docs/session-format.md](docs/session-format.md)。

### 管理

会话自动保存到 `~/.pi/agent/sessions/`，按工作目录组织。

```bash
pi -c                  # Continue most recent session
pi -r                  # Browse and select from past sessions
pi --no-session        # Ephemeral mode (don't save)
pi --name "my task"    # Set session display name at startup
pi --session <path|id> # Use specific session file or ID
pi --fork <path|id>    # Fork specific session file or ID into a new session
```

在交互模式中使用 `/session` 查看当前会话 ID，然后再用 `--session <id>` 或 `--fork <id>` 复用它。

### 分支

**`/tree`** - 原地导航会话树。选择任意先前点，从那里继续，并在分支之间切换。所有历史保留在单个文件中。

<p align="center"><img src="docs/images/tree-view.png" alt="Tree View" width="600"></p>

- 输入以搜索；用 Ctrl+←/Ctrl+→ 或 Alt+←/Alt+→ 折叠/展开并在分支间跳转；用 ←/→ 翻页
- 过滤模式（Ctrl+O）：default → no-tools → user-only → labeled-only → all
- 按 Ctrl+X 复制选中的消息
- 按 Shift+L 将条目标记为书签，按 Shift+T 切换标签时间戳

**`/fork`** - 从活动分支上先前的用户消息创建新会话文件。打开选择器，复制到该点为止的活动路径，并将所选提示放入编辑器以便修改。

**`/clone`** - 在当前位置将当前活动分支复制到新会话文件。新会话保留完整的活动路径历史，并以空编辑器打开。

**`--fork <path|id>`** - 从 CLI 直接 fork 现有会话文件或部分会话 UUID。这会将完整源会话复制到当前项目中的新会话文件。

### 压缩（Compaction）

长会话可能耗尽上下文窗口。压缩会总结较旧消息，同时保留较新消息。

**手动：** `/compact` 或 `/compact <custom instructions>`

**自动：** 默认启用。在上下文溢出时触发（恢复并重试），或在接近限制时主动触发。通过 `/settings` 或 `settings.json` 配置。

压缩是有损的。完整历史仍保留在 JSONL 文件中；使用 `/tree` 重新查看。可通过[扩展](#扩展)自定义压缩行为。内部细节见 [docs/compaction.md](docs/compaction.md)。

---

## 设置

使用 `/settings` 修改常用选项，或直接编辑 JSON 文件：

| 位置 | 范围 |
|----------|-------|
| `~/.pi/agent/settings.json` | 全局（所有项目） |
| `.pi/settings.json` | 项目（覆盖全局） |

所有选项见 [docs/settings.md](docs/settings.md)。

### 项目信任

在交互式启动时，若项目文件夹包含项目本地设置、资源或项目 `.agents/skills`，且 `~/.pi/agent/trust.json` 中对该文件夹或其父文件夹没有已保存决策，pi 会在信任该项目前询问。信任项目允许 pi 加载 `.pi/settings.json` 与 `.pi` 资源、安装缺失的项目包，并执行项目扩展。

在信任决策之前，pi 仅加载上下文文件、用户/全局扩展以及 CLI `-e` 扩展，以便它们能处理 `project_trust` 事件。项目本地扩展、项目包管理的扩展与项目设置仅在项目被信任后加载。当切换到来自不同 cwd、且当前进程尚未解决其信任的会话时，同样适用此拆分。

非交互模式（`-p`、`--mode json` 与 `--mode rpc`）不显示信任提示。若没有适用的已保存信任决策，它们使用全局设置中的 `defaultProjectTrust`：`ask`（默认）与 `never` 会忽略这些项目资源，而 `always` 会信任它们。传入 `--approve`/`-a` 或 `--no-approve`/`-na` 可覆盖单次运行的项目信任。

若没有扩展或已保存决策适用，`defaultProjectTrust` 控制回退行为。在 `~/.pi/agent/settings.json` 中将其设为 `"ask"`、`"always"` 或 `"never"`，或用 `/settings` 修改。

`pi config` 与包命令使用相同的项目信任流程，但 `pi update` 从不提示。传入 `--approve` 可在单次命令中信任项目本地设置，或传入 `--no-approve` 忽略它们。

在交互模式中使用 `/trust` 保存项目信任决策供未来会话使用，包括对直接父文件夹的信任。它仅写入 `~/.pi/agent/trust.json`；当前会话不会重新加载，因此需重启 pi 才能使更改生效。

### 遥测与更新检查

Pi 有两个独立的启动特性：

- **更新检查：** 请求 `https://pi.dev/api/latest-version` 以检查是否存在更新的 Pi 版本。用 `PI_SKIP_VERSION_CHECK=1` 禁用。禁用更新检查仅关闭此项检查。
- **安装/更新遥测：** 在首次安装或检测到 changelog 更新后，向 `https://pi.dev/api/report-install` 发送匿名版本 ping。该设置也控制 OpenRouter、Cloudflare 与直接 NVIDIA NIM 请求的可选提供商标识头。在 `settings.json` 中将 `enableInstallTelemetry` 设为 `false`，或设置 `PI_TELEMETRY=0` 可退出。这不会禁用更新检查；除非禁用更新检查或启用离线模式，Pi 仍可能联系 `pi.dev` 获取最新版本。

使用 `--offline` 或 `PI_OFFLINE=1` 可禁用此处描述的所有启动网络操作，包括更新检查、包更新检查与安装/更新遥测。

---

## 上下文文件

Pi 在启动时从以下位置加载 `AGENTS.md`（或 `CLAUDE.md`）：
- `~/.pi/agent/AGENTS.md`（全局）
- 父目录（从 cwd 向上遍历）
- 当前目录

若某目录包含 `AGENTS.override.md`，Pi 会加载它，而不是该目录中的 `AGENTS.md` 或 `CLAUDE.md`。其他目录的上下文文件仍会拼接。

用于项目指令（`AGENTS.md`/`CLAUDE.md`）、约定、常用命令。所有匹配文件都会拼接。

用 `--no-context-files`（或 `-nc`）禁用上下文文件加载。

### 系统提示

用 `.pi/SYSTEM.md`（项目）或 `~/.pi/agent/SYSTEM.md`（全局）替换默认系统提示。通过 `APPEND_SYSTEM.md` 追加而不替换。

---

## 自定义

### 提示模板

作为 Markdown 文件的可复用提示。输入 `/name` 展开。

```markdown
<!-- ~/.pi/agent/prompts/review.md -->
Review this code for bugs, security issues, and performance problems.
Focus on: {{focus}}
```

放在 `~/.pi/agent/prompts/`、`.pi/prompts/`，或 [pi package](#pi-packages) 中以便与他人分享。参见 [docs/prompt-templates.md](docs/prompt-templates.md)。

### Skills

遵循 [Agent Skills 标准](https://agentskills.io) 的按需能力包。通过 `/skill:name` 调用，或让 agent 自动加载。

```markdown
<!-- ~/.pi/agent/skills/my-skill/SKILL.md -->
# My Skill
Use this skill when the user asks about X.

## Steps
1. Do this
2. Then that
```

放在 `~/.pi/agent/skills/`、`~/.agents/skills/`、`.pi/skills/` 或 `.agents/skills/`（从 `cwd` 向上到父目录），或 [pi package](#pi-packages) 中以便与他人分享。参见 [docs/skills.md](docs/skills.md)。

### 扩展

<p align="center"><img src="docs/images/doom-extension.png" alt="Doom Extension" width="600"></p>

用 TypeScript 模块扩展 pi，添加自定义工具、命令、键盘快捷键、事件处理器与 UI 组件。

```typescript
export default function (pi: ExtensionAPI) {
  pi.registerTool({ name: "deploy", ... });
  pi.registerCommand("stats", { ... });
  pi.on("tool_call", async (event, ctx) => { ... });
}
```

默认导出也可以是 `async`。pi 会在启动继续之前等待异步扩展工厂，这适用于一次性初始化，例如在调用 `pi.registerProvider()` 之前获取远程模型列表。

**可以实现什么：**
- 自定义工具（或完全替换内置工具）
- 子 agent 与 plan mode
- 自定义压缩与摘要
- 权限门控与路径保护
- 自定义编辑器与 UI 组件
- 状态行、标头、页脚
- Git checkpointing 与自动提交
- SSH 与沙箱执行
- MCP 服务器集成
- 让 pi 看起来像 Claude Code
- 等待时玩游戏（是的，Doom 能跑）
- ……你能想到的任何事

放在 `~/.pi/agent/extensions/`、`.pi/extensions/`，或 [pi package](#pi-packages) 中以便与他人分享。参见 [docs/extensions.md](docs/extensions.md) 与 [examples/extensions/](examples/extensions/)。

### 主题

内置：`dark`、`light`。主题支持热重载：修改活动主题文件后，pi 会立即应用更改。

放在 `~/.pi/agent/themes/`、`.pi/themes/`，或 [pi package](#pi-packages) 中以便与他人分享。参见 [docs/themes.md](docs/themes.md)。

### Pi Packages

通过 npm 或 git 打包并分享扩展、skills、提示与主题。在 [npmjs.com](https://www.npmjs.com/search?q=keywords%3Api-package) 或 [Discord](https://discord.com/channels/1456806362351669492/1457744485428629628) 上查找包。

> **安全：** Pi packages 以完整系统访问权限运行。扩展可执行任意代码，skills 可指示模型执行任何操作（包括运行可执行文件）。安装第三方包前请审查源代码。

```bash
pi install npm:@foo/pi-tools
pi install npm:@foo/pi-tools@1.2.3      # pinned version
pi install git:github.com/user/repo
pi install git:github.com/user/repo@v1  # tag or commit
pi install git:git@github.com:user/repo
pi install git:git@github.com:user/repo@v1  # tag or commit
pi install https://github.com/user/repo
pi install https://github.com/user/repo@v1      # tag or commit
pi install ssh://git@github.com/user/repo
pi install ssh://git@github.com/user/repo@v1    # tag or commit
pi remove npm:@foo/pi-tools
pi uninstall npm:@foo/pi-tools          # alias for remove
pi list
pi update                               # update pi only
pi update --all                         # update pi and packages
pi update --extensions                  # update packages only
pi update --models                      # refresh model catalogs only
pi update --self                        # update pi only
pi update --self --force                # reinstall pi even if current
pi update npm:@foo/pi-tools             # update one package
pi config                               # enable/disable extensions, skills, prompts, themes
```

包安装到 `~/.pi/agent/git/`（git）或 `~/.pi/agent/npm/`（npm）。使用 `-l` 进行项目本地安装（`.pi/git/`、`.pi/npm/`）。Git `@ref` 值为固定标签或提交；固定包会被 `pi update --extensions` 与 `pi update --all` 跳过，因此使用 `pi install git:host/user/repo@new-ref` 将现有包移到新 ref。Git 包默认用 `npm install --omit=dev` 安装依赖，因此运行时依赖必须列在 `dependencies` 下；当配置了 `npmCommand` 时，git 包使用普通 `install` 以兼容包装器。若你使用 Node 版本管理器，并希望包安装复用稳定的 npm 上下文，请在 `settings.json` 中设置 `npmCommand`，例如 `["mise", "exec", "node@20", "--", "npm"]`。

通过在 `package.json` 中添加 `pi` 键创建包：

```json
{
  "name": "my-pi-package",
  "keywords": ["pi-package"],
  "pi": {
    "extensions": ["./extensions"],
    "skills": ["./skills"],
    "prompts": ["./prompts"],
    "themes": ["./themes"]
  }
}
```

若没有 `pi` 清单，pi 会从约定目录（`extensions/`、`skills/`、`prompts/`、`themes/`）自动发现。

参见 [docs/packages.md](docs/packages.md)。

---

## 编程式用法

### SDK

```typescript
import { createAgentSession, ModelRuntime, SessionManager } from "@earendil-works/pi-coding-agent";

const modelRuntime = await ModelRuntime.create();
const { session } = await createAgentSession({
  sessionManager: SessionManager.inMemory(),
  modelRuntime,
});

await session.prompt("What files are in the current directory?");
```

对于高级的多会话运行时替换，使用 `createAgentSessionRuntime()` 与 `AgentSessionRuntime`。

参见 [docs/sdk.md](docs/sdk.md) 与 [examples/sdk/](examples/sdk/)。

### RPC 模式

对于非 Node.js 集成，通过 stdin/stdout 使用 RPC 模式：

```bash
pi --mode rpc
```

RPC 模式使用严格的 LF 分隔 JSONL 帧。客户端必须仅按 `\n` 分割记录。不要使用像 Node `readline` 这样的通用行读取器，它也会在 JSON 载荷内的 Unicode 分隔符处分割。

协议见 [docs/rpc.md](docs/rpc.md)。

---

## 设计理念

Pi 极力可扩展，因此不必规定你的工作流。其他工具内置的功能可用[扩展](#扩展)、[skills](#skills) 构建，或从第三方 [pi packages](#pi-packages) 安装。这使核心保持精简，同时让你按自己的工作方式塑造 pi。

**没有 MCP。** 构建带 README 的 CLI 工具（见 [Skills](#skills)），或构建添加 MCP 支持的扩展。[为什么？](https://mariozechner.at/posts/2025-11-02-what-if-you-dont-need-mcp/)

**没有子 agent。** 实现方式很多。通过 tmux 生成 pi 实例，或用[扩展](#扩展)自己构建，或安装按你方式实现的包。

**没有权限弹窗。** 在容器中运行，或用[扩展](#扩展)按你的环境与安全要求构建自己的确认流程。

**没有 plan mode。** 将计划写入文件，或用[扩展](#扩展)构建，或安装包。

**没有内置 to-dos。** 它们会让模型困惑。使用 TODO.md 文件，或用[扩展](#扩展)自己构建。

**没有后台 bash。** 使用 tmux。完整可观测性，直接交互。

完整理由见[这篇博客](https://mariozechner.at/posts/2025-11-30-pi-coding-agent/)。

---

## CLI 参考

```bash
pi [options] [@files...] [messages...]
```

### 包命令

```bash
pi install <source> [-l]     # Install package, -l for project-local
pi remove <source> [-l]      # Remove package
pi uninstall <source> [-l]   # Alias for remove
pi update [source|self|pi]   # Update pi only, or one package source
pi update --all              # Update pi and packages
pi update --extensions       # Update packages only
pi update --models           # Refresh model catalogs only
pi update --self             # Update pi only
pi update --self --force     # Reinstall pi even if current
pi update --extension <src>  # Update one package
pi list                      # List installed packages
pi config                    # Enable/disable package resources
```

`pi config` 与项目包命令接受 `--approve`/`--no-approve`，以便在单次命令中信任或忽略项目本地设置。`pi update` 从不提示项目信任。

### 模式

| 标志 | 说明 |
|------|-------------|
| （默认） | 交互模式 |
| `-p`, `--print` | 打印响应并退出 |
| `--mode json` | 将所有事件输出为 JSON lines（见 [docs/json.md](docs/json.md)） |
| `--mode rpc` | 用于进程集成的 RPC 模式（见 [docs/rpc.md](docs/rpc.md)） |
| `--export <in> [out]` | 将会话导出为 HTML |

在 print 模式中，pi 也会读取管道 stdin 并将其合并到初始提示中：

```bash
cat README.md | pi -p "Summarize this text"
```

### 模型选项

| 选项 | 说明 |
|--------|-------------|
| `--provider <name>` | 提供商（anthropic、openai、google 等） |
| `--model <pattern>` | 模型模式或 ID（支持 `provider/id` 与可选的 `:<thinking>`） |
| `--api-key <key>` | API key（覆盖环境变量） |
| `--thinking <level>` | `off`、`minimal`、`low`、`medium`、`high`、`xhigh`、`max` |
| `--models <patterns>` | 用于 Ctrl+P 循环的逗号分隔模式 |
| `--list-models [search]` | 列出可用模型 |

### 会话选项

| 选项 | 说明 |
|--------|-------------|
| `-c`, `--continue` | 继续最近会话 |
| `-r`, `--resume` | 浏览并选择会话 |
| `--session <path\|id>` | 使用特定会话文件或部分 UUID |
| `--fork <path\|id>` | 将特定会话文件或部分 UUID fork 到新会话 |
| `--session-dir <dir>` | 自定义会话存储目录 |
| `--no-session` | 临时模式（不保存） |
| `--name <name>`, `-n <name>` | 在启动时设置会话显示名称 |

### 工具选项

| 选项 | 说明 |
|--------|-------------|
| `--tools <list>`, `-t <list>` | 在内置、扩展与自定义工具中允许特定工具名 |
| `--exclude-tools <list>`, `-xt <list>` | 在内置、扩展与自定义工具中禁用特定工具名 |
| `--no-builtin-tools`, `-nbt` | 默认禁用内置工具，但保持扩展/自定义工具启用 |
| `--no-tools`, `-nt` | 默认禁用所有工具 |

可用内置工具：`read`、`bash`、`edit`、`write`、`grep`、`find`、`ls`

### 资源选项

| 选项 | 说明 |
|--------|-------------|
| `-e`, `--extension <source>` | 从路径、npm 或 git 加载扩展（可重复） |
| `--no-extensions` | 禁用扩展发现 |
| `--skill <path>` | 加载 skill（可重复） |
| `--no-skills` | 禁用 skill 发现 |
| `--prompt-template <path>` | 加载提示模板（可重复） |
| `--no-prompt-templates` | 禁用提示模板发现 |
| `--theme <path>` | 加载主题（可重复） |
| `--no-themes` | 禁用主题发现 |
| `--no-context-files`, `-nc` | 禁用 AGENTS.md 与 CLAUDE.md 上下文文件发现 |

将 `--no-*` 与显式标志组合，以精确加载所需内容并忽略 settings.json（例如 `--no-extensions -e ./my-ext.ts`）。

### 其他选项

| 选项 | 说明 |
|--------|-------------|
| `--system-prompt <text>` | 替换默认提示（上下文文件与 skills 仍会追加） |
| `--append-system-prompt <text>` | 追加到系统提示 |
| `--tui-mode <mode>` | TUI 模式：`regular`（默认）或实验性 `fullscreen` |
| `--verbose` | 强制详细启动 |
| `-a`, `--approve` | 本次运行信任项目本地文件 |
| `-na`, `--no-approve` | 本次运行忽略项目本地文件 |
| `-h`, `--help` | 显示帮助 |
| `-v`, `--version` | 显示版本 |

### 文件参数

用 `@` 前缀文件以包含在消息中：

```bash
pi @prompt.md "Answer this"
pi -p @screenshot.png "What's in this image?"
pi @code.ts @test.ts "Review these files"
```

### 示例

```bash
# Interactive with initial prompt
pi "List all .ts files in src/"

# Non-interactive
pi -p "Summarize this codebase"

# Non-interactive with piped stdin
cat README.md | pi -p "Summarize this text"

# Named one-shot session
pi --name "release audit" -p "Audit this repository"

# Different model
pi --provider openai --model gpt-4o "Help me refactor"

# Model with provider prefix (no --provider needed)
pi --model openai/gpt-4o "Help me refactor"

# Model with thinking level shorthand
pi --model sonnet:high "Solve this complex problem"

# Limit model cycling
pi --models "claude-*,gpt-4o"

# Read-only mode
pi --tools read,grep,find,ls -p "Review the code"

# Disable one extension or built-in tool while keeping the rest available
pi --exclude-tools ask_question

# High thinking level
pi --thinking high "Solve this complex problem"
```

### 环境变量

| 变量 | 说明 |
|----------|-------------|
| `AI_AGENT` | 由 CLI 与 RPC 入口点设为 `pi`，以便通用工具将子进程归因于 Pi |
| `PI_CODING_AGENT` | 由 CLI 与 RPC 入口点设为 `true`，以便子进程检测自己在 Pi 内运行 |
| `PI_CODING_AGENT_DIR` | 覆盖配置目录（默认：`~/.pi/agent`） |
| `PI_CODING_AGENT_SESSION_DIR` | 覆盖会话存储目录（会被 `--session-dir` 覆盖） |
| `PI_PACKAGE_DIR` | 覆盖包目录（对 Nix/Guix 有用，因为 store 路径分词较差） |
| `PI_OFFLINE` | 禁用启动网络操作，包括更新检查、包更新检查与安装/更新遥测 |
| `PI_SKIP_VERSION_CHECK` | 跳过启动时的 Pi 版本更新检查。这会阻止对 `pi.dev` 最新版本的请求 |
| `PI_TELEMETRY` | 覆盖安装/更新遥测与提供商标识头。用 `1`/`true`/`yes` 启用，或 `0`/`false`/`no` 禁用。这不会禁用更新检查 |
| `PI_CACHE_RETENTION` | 设为 `long` 以延长提示缓存（Anthropic：1h，OpenAI：24h） |
| `VISUAL`, `EDITOR` | 当 `externalEditor` 未设置时，Ctrl+G 的回退外部编辑器；Windows 默认为 Notepad，其他平台为 `nano` |

LLM 可调用的 bash 工具运行的命令也会收到当前会话元数据：

| 变量 | 说明 |
|----------|-------------|
| `PI_SESSION_ID` | 当前会话 ID |
| `PI_SESSION_FILE` | 绝对会话 JSONL 路径；临时会话未设置 |
| `PI_PROVIDER` | 当前所选模型提供商 |
| `PI_MODEL` | 当前所选模型 ID |
| `PI_REASONING_LEVEL` | 当前有效 reasoning 级别 |

这些值在每个命令启动时解析。语义、示例与自定义工具退出选项见 [Environment Variables](docs/environment-variables.md#bash-tool-session-environment)。

---

## 贡献与开发

指南见 [CONTRIBUTING.md](../../CONTRIBUTING.md)；设置、fork 与调试见 [docs/development.md](docs/development.md)。

## 许可证

MIT

## 另见

- [@earendil-works/pi-ai](https://www.npmjs.com/package/@earendil-works/pi-ai)：核心 LLM 工具包
- [@earendil-works/pi-agent-core](https://www.npmjs.com/package/@earendil-works/pi-agent-core)：Agent 框架
- [@earendil-works/pi-tui](https://www.npmjs.com/package/@earendil-works/pi-tui)：终端 UI 组件

<p align="center">
  <a href="https://pi.dev">pi.dev</a> domain graciously donated by
  <br /><br />
  <a href="https://exe.dev"><img src="docs/images/exy.png" alt="Exy mascot" width="48" /><br />exe.dev</a>
</p>
