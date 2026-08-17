# 使用 Pi

本页汇总不适合放在快速开始页中的日常用法细节。

## 交互模式

<p align="center"><img src="images/interactive-mode.png" alt="Interactive Mode" width="600"></p>

界面有四个主要区域：

- **启动头** - 快捷键、已加载的上下文文件、提示模板、skills 与扩展
- **消息** - 用户消息、助手回复、工具调用、工具结果、通知、错误与扩展 UI
- **编辑器** - 输入区域；边框颜色表示当前思考级别
- **页脚** - 工作目录、会话名、token/缓存用量、费用、上下文用量与当前模型。合计包括助手回复、工具报告的用量以及摘要生成。

编辑器可被诸如 `/settings` 的内置 UI 或自定义扩展 UI 临时替换。

### 编辑器功能

| 功能 | 用法 |
|---------|-----|
| 文件引用 | 输入 `@` 模糊搜索项目文件 |
| 路径补全 | 按 Tab 补全路径 |
| 多行输入 | Shift+Enter，或在 Windows Terminal 上用 Ctrl+Enter |
| 复制回复 | Ctrl+X 复制最后一条助手消息；在 `/tree` 中复制选中的消息 |
| 图片 | 用 Ctrl+V 粘贴，Windows 上用 Alt+V，或拖入终端 |
| Shell 命令 | `!command` 运行并将输出发给模型 |
| 隐藏 Shell 命令 | `!!command` 运行但不将输出发给模型 |
| 外部编辑器 | Ctrl+G 打开 `externalEditor`、`$VISUAL`、`$EDITOR`，Windows 上为 Notepad，其他平台为 `nano` |

所有快捷键与自定义见 [快捷键](keybindings.md)。

## 斜杠命令

在编辑器中输入 `/` 打开命令补全。扩展可注册自定义命令，skills 可用作 `/skill:name`，提示模板通过 `/templatename` 展开。

| 命令 | 说明 |
|---------|-------------|
| `/login`、`/logout` | 管理 OAuth 或 API 密钥凭证 |
| [`/llama`](llama-cpp.md) | 下载、加载与卸载 llama.cpp router 模型 |
| `/model` | 切换模型 |
| `/scoped-models` | 启用/禁用用于 Ctrl+P 循环的模型 |
| `/settings` | 思考级别、主题、消息投递、传输方式 |
| `/resume` | 从以往会话中选择 |
| `/new` | 开始新会话 |
| `/name <name>` | 设置会话显示名 |
| `/session` | 显示会话文件、ID、消息、token 与费用 |
| `/tree` | 跳转到会话中的任意点并从那里继续 |
| `/trust` | 保存项目信任决策供后续会话使用 |
| `/fork` | 从先前某条用户消息创建新会话 |
| `/clone` | 将当前活动分支复制到新会话 |
| `/compact [prompt]` | 手动压缩上下文，可选自定义说明 |
| `/copy` | 将最后一条助手消息复制到剪贴板 |
| `/export [file]` | 将会话导出为 HTML 或 JSONL |
| `/import <file>` | 从 JSONL 文件导入并恢复会话 |
| `/share` | 上传为私有 GitHub gist，并带可分享的 HTML 链接 |
| `/reload` | 重新加载快捷键、扩展、skills、提示、主题与上下文文件 |
| `/hotkeys` | 显示所有键盘快捷键 |
| `/changelog` | 显示版本历史 |
| `/quit` | 退出 pi |

## 消息队列

可在 agent 仍在工作时提交消息：

- **Enter** 排队一条引导（steering）消息，在当前助手回合完成其工具调用后投递。
- **Alt+Enter** 排队一条后续（follow-up）消息，在 agent 完成所有工作后投递。
- **Escape** 中止并将已排队消息恢复到编辑器。
- **Alt+Up** 将已排队消息取回编辑器。

在 Windows Terminal 上，Alt+Enter 默认是全屏。若希望 pi 收到该快捷键，请按 [终端设置](terminal-setup.md) 重新映射。

在 [设置](settings.md) 中用 `steeringMode` 与 `followUpMode` 配置投递方式。

## 会话

会话会自动保存到 `~/.pi/agent/sessions/`，按工作目录组织。

```bash
pi -c                  # Continue most recent session
pi -r                  # Browse and select a session
pi --no-session        # Ephemeral mode; do not save
pi --name "my task"    # Set session display name at startup
pi --session <path|id> # Use a specific session file or session ID
pi --fork <path|id>    # Fork a session into a new session file
```

有用的会话命令：

- `/session` 显示当前会话文件与 ID。
- `/tree` 导航文件内会话树，并可对遗弃分支做摘要。
- `/fork` 从较早的用户消息创建新会话。
- `/clone` 将当前活动分支复制到新会话文件。
- `/compact` 摘要旧消息以释放上下文。

详情见 [会话](sessions.md) 与 [压缩](compaction.md)。

## 上下文文件

Pi 启动时从以下位置加载 `AGENTS.md` 或 `CLAUDE.md`：

- `~/.pi/agent/AGENTS.md` 作为全局说明
- 从当前工作目录向上遍历的父目录
- 当前目录

若某目录包含 `AGENTS.override.md`，Pi 会加载它，而不是该目录中的 `AGENTS.md` 或 `CLAUDE.md`。其他目录的上下文文件仍会正常分层加载。

用上下文文件存放项目约定、命令、安全规则与偏好。用 `--no-context-files` 或 `-nc` 禁用加载。

### 系统提示文件

用以下文件替换默认系统提示：

- 项目：`.pi/SYSTEM.md`
- 全局：`~/.pi/agent/SYSTEM.md`

在任一位置使用 `APPEND_SYSTEM.md` 可追加到默认提示而不替换它。

### 项目信任

交互启动时，若项目文件夹包含项目本地设置、资源或项目 `.agents/skills`，且该文件夹或其父文件夹在 `~/.pi/agent/trust.json` 中没有已保存决策，pi 会先询问是否信任。信任项目后，pi 可加载 `.pi/settings.json` 与 `.pi` 资源、安装缺失的项目包，并执行项目扩展。

在信任决策之前，pi 仅加载上下文文件、用户/全局扩展与 CLI `-e` 扩展，以便它们能处理 `project_trust` 事件。项目本地扩展、项目包管理的扩展以及项目设置仅在项目被信任后加载。切换到来自不同 cwd、且当前进程尚未解析信任的会话时，同样适用此拆分。

非交互模式（`-p`、`--mode json` 与 `--mode rpc`）不会显示信任提示。在没有适用的已保存信任决策时，它们使用全局设置中的 `defaultProjectTrust`：`ask`（默认）与 `never` 会忽略这些项目资源，而 `always` 会信任它们。传入 `--approve`/`-a` 或 `--no-approve`/`-na` 可覆盖单次运行的项目信任。

若没有扩展或已保存决策适用，则由 `defaultProjectTrust` 控制回退行为。在 `~/.pi/agent/settings.json` 中将其设为 `"ask"`、`"always"` 或 `"never"`，或用 `/settings` 更改。

`pi config` 与包命令使用相同的项目信任流程，但 `pi update` 从不提示。传入 `--approve` 可在单次命令中信任项目本地设置，或 `--no-approve` 忽略它们。

在交互模式中使用 `/trust` 可保存项目信任决策供后续会话使用，包括对直接父文件夹的信任。它仅写入 `~/.pi/agent/trust.json`；当前会话不会重新加载，因此需重启 pi 才能生效。


## 导出会话与分享

使用 `/export [file]` 将会话写入 HTML。

使用 `/share` 上传私有 GitHub gist，并获得可分享的 HTML 链接。

若你用 pi 做开源工作，并希望发布会话以供模型、提示、工具与评估研究，见 [`badlogic/pi-share-hf`](https://github.com/badlogic/pi-share-hf)。它会将会话发布到 Hugging Face datasets。

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
pi update --all              # Update pi and packages; reconcile pinned git refs
pi update --extensions       # Update packages only; reconcile pinned git refs
pi update --models           # Refresh model catalogs only
pi update --self             # Update pi only
pi update --extension <src>  # Update one package
pi list                      # List installed packages
pi config                    # Enable/disable package resources
```

这些命令管理 pi 包，且 `pi update` 可更新 pi CLI 安装。要卸载 pi 本身，见 [快速开始](quickstart.md#uninstall)。`pi config` 与项目包命令接受 `--approve`/`--no-approve`，以在单次命令中信任或忽略项目本地设置。`pi update` 从不提示项目信任。

包来源与安全说明见 [Pi 包](packages.md)。

### 模式

| 标志 | 说明 |
|------|-------------|
| 默认 | 交互模式 |
| `-p`、`--print` | 打印回复后退出 |
| `--mode json` | 将所有事件输出为 JSON 行；见 [JSON 模式](json.md) |
| `--mode rpc` | 通过 stdin/stdout 的 RPC 模式；见 [RPC 模式](rpc.md) |
| `--export <in> [out]` | 将会话导出为 HTML |

在打印模式中，pi 也会读取管道传入的 stdin，并将其合并到初始提示：

```bash
cat README.md | pi -p "Summarize this text"
```

### 模型选项

| 选项 | 说明 |
|--------|-------------|
| `--provider <name>` | 提供商，如 `anthropic`、`openai` 或 `google` |
| `--model <pattern>` | 模型模式或 ID；支持 `provider/id` 以及可选的 `:<thinking>` |
| `--api-key <key>` | API 密钥，覆盖环境变量 |
| `--thinking <level>` | `off`、`minimal`、`low`、`medium`、`high`、`xhigh`、`max` |
| `--models <patterns>` | 供 Ctrl+P 循环使用的逗号分隔模式 |
| `--list-models [search]` | 列出可用模型 |

### 会话选项

| 选项 | 说明 |
|--------|-------------|
| `-c`、`--continue` | 继续最近的会话 |
| `-r`、`--resume` | 浏览并选择会话 |
| `--session <path\|id>` | 使用特定会话文件或部分 UUID |
| `--fork <path\|id>` | 将会话文件或部分 UUID fork 到新会话 |
| `--session-dir <dir>` | 自定义会话存储目录 |
| `--no-session` | 临时模式；不保存 |
| `--name <name>`、`-n <name>` | 启动时设置会话显示名 |

### 工具选项

| 选项 | 说明 |
|--------|-------------|
| `--tools <list>`、`-t <list>` | 允许特定内置、扩展与自定义工具的白名单 |
| `--exclude-tools <list>`、`-xt <list>` | 禁用特定内置、扩展与自定义工具 |
| `--no-builtin-tools`、`-nbt` | 禁用内置工具，但保留扩展/自定义工具 |
| `--no-tools`、`-nt` | 禁用所有工具 |

内置工具：`read`、`bash`、`edit`、`write`、`grep`、`find`、`ls`。

### 资源选项

| 选项 | 说明 |
|--------|-------------|
| `-e`、`--extension <source>` | 从路径、npm 或 git 加载扩展；可重复 |
| `--no-extensions` | 禁用扩展发现 |
| `--skill <path>` | 加载 skill；可重复 |
| `--no-skills` | 禁用 skill 发现 |
| `--prompt-template <path>` | 加载提示模板；可重复 |
| `--no-prompt-templates` | 禁用提示模板发现 |
| `--theme <path>` | 加载主题；可重复 |
| `--no-themes` | 禁用主题发现 |
| `--no-context-files`、`-nc` | 禁用 `AGENTS.md` 与 `CLAUDE.md` 发现 |

将 `--no-*` 与显式标志组合，可精确加载所需内容并忽略设置。例如：

```bash
pi --no-extensions -e ./my-extension.ts
```

### 其他选项

| 选项 | 说明 |
|--------|-------------|
| `--system-prompt <text>` | 替换默认提示；上下文文件与 skills 仍会追加 |
| `--append-system-prompt <text>` | 追加到系统提示 |
| `--tui-mode <mode>` | TUI 模式：`regular`（默认）或实验性 `fullscreen` |
| `--verbose` | 强制详细启动输出 |
| `-a`、`--approve` | 本次运行信任项目本地文件 |
| `-na`、`--no-approve` | 本次运行忽略项目本地文件 |
| `-h`、`--help` | 显示帮助 |
| `-v`、`--version` | 显示版本 |

在 `fullscreen` 模式中，对话记录在终端视口内滚动，而已排队消息、工作状态、扩展组件、编辑器与页脚固定在底部。鼠标/触控板输入滚动指针下方区域；键盘视口操作始终可用。内联图片在支持 Kitty 图形协议的终端中可用，包括 Kitty 与 Ghostty。在 iTerm2 中它们渲染为文本占位符，因为其内联图片协议无法在应用自管滚动期间删除或裁剪放置。在 `regular` 模式中，pi 使用主屏幕与终端自管回滚，iTerm2 内联图片继续正常渲染。

在 `/settings` 中设置 **TUI mode**，可立即在 `regular` 与 `fullscreen` 间切换，并选择未来会话的默认值。

### 文件参数

用 `@` 前缀将文件包含到消息中：

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

# Model with provider prefix
pi --model openai/gpt-4o "Help me refactor"

# Model with thinking level shorthand
pi --model sonnet:high "Solve this complex problem"

# Limit model cycling
pi --models "claude-*,gpt-4o"

# Read-only mode
pi --tools read,grep,find,ls -p "Review the code"

# Disable one extension or built-in tool while keeping the rest available
pi --exclude-tools ask_question
```

## 设计原则

Pi 保持核心精简，并将工作流相关行为推到扩展、skills、提示模板与包中。

它有意不包含内置 MCP、子 agent、权限弹窗、计划模式、待办事项或后台 bash。你可将这些工作流构建或安装为扩展或包，或使用容器与 tmux 等外部工具。

完整理由见[这篇博文](https://mariozechner.at/posts/2025-11-30-pi-coding-agent/)。
