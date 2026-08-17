# 快速开始

本页带你从安装走到一次可用的首次 pi 会话。

## 安装

Pi 以 npm 包形式分发：

```bash
npm install -g --ignore-scripts @earendil-works/pi-coding-agent
```

`--ignore-scripts` 会在安装时禁用依赖的生命周期脚本。Pi 的常规 npm 安装不需要这些安装脚本。

### 卸载

使用当初安装 pi 的包管理器。curl 安装脚本会全局使用 npm，因此 curl 与 npm 安装都用 npm 卸载：

```bash
# curl 安装脚本或 npm install -g
npm uninstall -g @earendil-works/pi-coding-agent

# pnpm
pnpm remove -g @earendil-works/pi-coding-agent

# Yarn
yarn global remove @earendil-works/pi-coding-agent

# Bun
bun uninstall -g @earendil-works/pi-coding-agent
```

卸载 pi 不会删除 `~/.pi/agent/` 中的设置、凭证、会话与已安装的 pi 包。

然后在你希望它处理的项目目录中启动 pi：

```bash
cd /path/to/project
pi
```

## 认证

Pi 可通过 `/login` 使用订阅类提供商，也可通过环境变量或 auth 文件使用 API 密钥提供商。

### 方式 1：订阅登录

启动 pi 并运行：

```text
/login
```

然后选择提供商。内置订阅登录包括 Claude Pro/Max、ChatGPT Plus/Pro（Codex）以及 GitHub Copilot。

### 方式 2：API 密钥

在启动 pi 前设置 API 密钥：

```bash
export ANTHROPIC_API_KEY=sk-ant-...
pi
```

也可运行 `/login` 并选择 API 密钥提供商，将密钥存入 `~/.pi/agent/auth.json`。

所有支持的提供商、环境变量与云提供商配置见 [提供商](providers.md)。

## 第一次会话

pi 启动后，输入请求并按 Enter：

```text
Summarize this repository and tell me how to run its checks.
```

默认情况下，pi 向模型提供四个工具：

- `read` - 读取文件
- `write` - 创建或覆盖文件
- `edit` - 修补文件
- `bash` - 运行 shell 命令

其他内置只读工具（`grep`、`find`、`ls`）可通过工具选项启用。Pi 在你当前工作目录中运行，并可修改其中的文件。若需要方便回滚，请使用 git 或其他检查点工作流。

## 给 pi 项目说明

Pi 会在启动时加载上下文文件。添加 `AGENTS.md` 可告诉它如何在项目中工作：

```markdown
# Project Instructions

- Run `npm run check` after code changes.
- Do not run production migrations locally.
- Keep responses concise.
```

Pi 会加载：

- `~/.pi/agent/AGENTS.md` 作为全局说明
- 父目录与当前目录中的 `AGENTS.md` 或 `CLAUDE.md`

若某目录包含 `AGENTS.override.md`，Pi 会加载它，而不是该目录中的 `AGENTS.md` 或 `CLAUDE.md`。

修改上下文文件后，重启 pi，或运行 `/reload`。

## 常见用法

### 引用文件

在编辑器中输入 `@` 可模糊搜索文件，或在命令行传入文件：

```bash
pi @README.md "Summarize this"
pi @src/app.ts @src/app.test.ts "Review these together"
```

可用 Ctrl+V（Windows 上为 Alt+V）粘贴图片或文本；在支持的终端中也可拖入图片。

### 运行 shell 命令

在交互模式中：

```text
!npm run lint
```

命令输出会发送给模型。使用 `!!command` 可运行命令但不把输出加入模型上下文。

### 切换模型

用 `/model` 或 Ctrl+L 选择模型。用 Shift+Tab 循环思考级别。用 Ctrl+P / Shift+Ctrl+P 在已限定范围内的模型间循环。

### 稍后继续

会话会自动保存：

```bash
pi -c                  # Continue most recent session
pi -r                  # Browse previous sessions
pi --name "my task"    # Set session display name at startup
pi --session <path|id> # Open a specific session
```

在 pi 内可用 `/resume`、`/new`、`/tree`、`/fork` 和 `/clone` 管理会话。

### 非交互模式

一次性提示：

```bash
pi -p "Summarize this codebase"
cat README.md | pi -p "Summarize this text"
pi -p @screenshot.png "What's in this image?"
```

使用 `--mode json` 获取 JSON 事件输出，或 `--mode rpc` 用于进程集成。

## 下一步

- [使用 Pi](usage.md) - 交互模式、斜杠命令、会话、上下文文件与 CLI 参考。
- [提供商](providers.md) - 认证与模型配置。
- [设置](settings.md) - 全局与项目配置。
- [快捷键](keybindings.md) - 快捷键与自定义。
- [Pi 包](packages.md) - 安装共享的扩展、skills、提示与主题。

平台说明：[Windows](windows.md)、[Termux](termux.md)、[tmux](tmux.md)、[终端设置](terminal-setup.md)、[Shell 别名](shell-aliases.md)。
