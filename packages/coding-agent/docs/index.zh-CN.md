# Pi 文档

Pi 是一个极简的终端编程运行时（harness）。核心刻意保持精简，通过 TypeScript 扩展、skills、提示模板、主题和 pi 包来扩展能力。

## 快速开始

用 npm 安装 Pi：

```bash
npm install -g --ignore-scripts @earendil-works/pi-coding-agent
```

`--ignore-scripts` 会在安装时禁用依赖的生命周期脚本。Pi 的常规 npm 安装不需要这些安装脚本。

在 Linux 或 macOS 上，也可以使用安装脚本：

```bash
curl -fsSL https://pi.dev/install.sh | sh
```

卸载 pi 本身时，curl 与 npm 安装都用 npm：

```bash
npm uninstall -g @earendil-works/pi-coding-agent
```

若用 pnpm、Yarn 或 Bun 安装，请使用对应的全局卸载命令：`pnpm remove -g @earendil-works/pi-coding-agent`、`yarn global remove @earendil-works/pi-coding-agent`，或 `bun uninstall -g @earendil-works/pi-coding-agent`。

然后在项目目录中运行：

```bash
pi
```

对订阅类提供商使用 `/login` 认证，或在启动 pi 前设置 API 密钥（例如 `ANTHROPIC_API_KEY`）。

完整的首次运行流程见 [快速开始](quickstart.md)。

## 从这里开始

- [快速开始](quickstart.md) - 安装、认证，并完成第一次会话。
- [使用 Pi](usage.md) - 交互模式、斜杠命令、上下文文件与 CLI 参考。
- [提供商](providers.md) - 内置提供商的订阅与 API 密钥配置。
- [llama.cpp](llama-cpp.md) - 运行本地 router，并用 `/llama` 管理模型。
- [安全](security.md) - 项目信任、沙箱边界与漏洞报告。
- [容器化](containerization.md) - 用 Gondolin、Docker 或 OpenShell 沙箱化 pi。
- [设置](settings.md) - 全局与项目设置。
- [快捷键](keybindings.md) - 默认快捷键与自定义绑定。
- [会话](sessions.md) - 会话管理、分支与树导航。
- [压缩](compaction.md) - 上下文压缩与分支摘要。

## 自定义

- [扩展](extensions.md) - 用于工具、命令、事件与自定义 UI 的 TypeScript 模块。
- [Skills](skills.md) - 可按需复用的 Agent Skills。
- [提示模板](prompt-templates.md) - 通过斜杠命令展开的可复用提示。
- [主题](themes.md) - 内置与自定义终端主题。
- [Pi 包](packages.md) - 打包并分享扩展、skills、提示与主题。
- [自定义模型](models.md) - 为支持的提供商 API 添加模型条目。
- [自定义提供商](custom-provider.md) - 实现自定义 API 与 OAuth 流程。

## 编程式使用

- [SDK](sdk.md) - 在 Node.js 应用中嵌入 pi。
- [RPC 模式](rpc.md) - 通过 stdin/stdout JSONL 集成。
- [JSON 事件流模式](json.md) - 带结构化事件的打印模式。
- [TUI 组件](tui.md) - 为扩展构建自定义终端 UI。

## 参考

- [环境变量](environment-variables.md) - Pi 进程配置，以及 bash 工具可用的会话元数据。
- [会话格式](session-format.md) - JSONL 会话文件格式、条目类型与 SessionManager API。

## 平台设置

- [Windows](windows.md)
- [Android 上的 Termux](termux.md)
- [tmux](tmux.md)
- [终端设置](terminal-setup.md)
- [Shell 别名](shell-aliases.md)

## 开发

- [开发](development.md) - 本地搭建、项目结构与调试。
