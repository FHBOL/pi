<p align="center">
  <a href="https://pi.dev">
    <img alt="pi logo" src="https://pi.dev/logo-auto.svg" width="128">
  </a>
</p>
<p align="center">
  <a href="https://discord.com/invite/3cU7Bz4UPx"><img alt="Discord" src="https://img.shields.io/badge/discord-community-5865F2?style=flat-square&logo=discord&logoColor=white" /></a>
  <a href="https://www.npmjs.com/package/@earendil-works/pi-coding-agent"><img alt="npm" src="https://img.shields.io/npm/v/@earendil-works/pi-coding-agent?style=flat-square" /></a>
</p>

> 新贡献者提交的 issue 和 PR 默认会被自动关闭。维护者每日会审阅被自动关闭的 issue。详见 [CONTRIBUTING.md](CONTRIBUTING.md)。

# Pi Agent Harness

本仓库是 Pi agent harness（Agent 运行框架）项目的主页，包含我们可自我扩展的 coding agent（编程助手）。

* **[@earendil-works/pi-coding-agent](packages/coding-agent)**：交互式 coding agent CLI
* **[@earendil-works/pi-agent-core](packages/agent)**：支持工具调用与状态管理的 Agent 运行时
* **[@earendil-works/pi-ai](packages/ai)**：统一的多提供商 LLM API（OpenAI、Anthropic、Google 等）

了解更多关于 Pi 的信息：

* [访问 pi.dev](https://pi.dev)，项目官网与演示
* [阅读文档](https://pi.dev/docs/latest)，你也可以直接让 agent 解释自身

## 全部包

| 包 | 说明 |
|---------|-------------|
| **[@earendil-works/pi-telemetry](packages/telemetry)** | 厂商无关的遥测契约、参考适配器、一致性测试与类型化 schema |
| **[@earendil-works/pi-ai](packages/ai)** | 统一的多提供商 LLM API（OpenAI、Anthropic、Google 等） |
| **[@earendil-works/pi-agent-core](packages/agent)** | 支持工具调用与状态管理的 Agent 运行时 |
| **[@earendil-works/pi-coding-agent](packages/coding-agent)** | 交互式 coding agent CLI |
| **[@earendil-works/pi-tui](packages/tui)** | 带差分渲染的终端 UI 库 |

Slack/聊天自动化与工作流见 [earendil-works/pi-chat](https://github.com/earendil-works/pi-chat)。

## 权限与容器化

Pi 不包含用于限制文件系统、进程、网络或凭据访问的内置权限系统。默认情况下，它以启动它的用户和进程的权限运行。

若需要更强边界，请对 Pi 进行容器化或沙箱隔离。参见 [packages/coding-agent/docs/containerization.md](packages/coding-agent/docs/containerization.md) 中的三种模式：

- **Gondolin 扩展**：在主机上保留 `pi` 与提供商认证，同时将内置工具与 `!` 命令路由到本地 Linux 微虚拟机。
- **普通 Docker**：将整个 `pi` 进程运行在本地容器中，实现简单隔离。
- **OpenShell**：将整个 `pi` 进程运行在策略可控的沙箱中。

## 贡献

贡献指南见 [CONTRIBUTING.md](CONTRIBUTING.md)；项目特定规则（适用于人类与 agent）见 [AGENTS.md](AGENTS.md)。Pi 的更长期规划也可在 [RFCs](https://rfc.earendil.com/keyword/pi/) 中查阅。

## 开发

```bash
npm install --ignore-scripts  # 安装全部依赖，不运行生命周期脚本
npm run build         # 刷新模型数据，然后构建全部包
npm run build:offline # 使用已有模型数据重建，无需网络
npm run check         # Lint、格式化与类型检查
./test.sh            # 运行测试（无 API key 时跳过依赖 LLM 的测试）
./pi-test.sh         # 从源码运行 pi（可在任意目录执行）
```

## 从发布源码构建独立二进制

GitHub releases 包含带版本号的源码归档，并受该次 release 的 `SHA256SUMS` 文件覆盖。解压后运行与官方独立二进制相同的构建脚本：

```bash
VERSION="<release-version>"
tar -xzf "pi-${VERSION}-source.tar.gz"
cd "pi-${VERSION}"
./scripts/build-binaries.sh --offline-model-data --platform linux-x64 --out "$PWD/out"
```

源码归档包含该次发布所用的已生成提供商模型数据。`--offline-model-data` 使用该快照构建，而不是从实时提供商目录刷新。脚本仍会安装依赖、构建 monorepo、编译 Bun 可执行文件并暂存其运行时资源。若包维护者另行提供依赖，可传入 `--skip-install --skip-deps`。

## 供应链加固

我们将 npm 依赖变更视为需审阅的代码变更。

- 直接外部依赖固定为精确版本。内部 workspace 包仍使用版本范围。
- `.npmrc` 设置 `save-exact=true` 与 `min-release-age=2`，避免在 npm 解析时拉到当日刚发布的依赖。
- `package-lock.json` 是依赖的事实来源。除非设置 `PI_ALLOW_LOCKFILE_CHANGE=1`，pre-commit 会阻止意外提交 lockfile。
- `npm run check` 会校验直接依赖是否固定、原生 TypeScript import 兼容性，以及生成的 coding-agent shrinkwrap。
- 已发布的 CLI 包包含由根 lockfile 生成的 `packages/coding-agent/npm-shrinkwrap.json`，为 npm 用户固定传递依赖。
- 发布冒烟测试使用 `npm run release:local`，在打标签前于仓库外构建、打包并创建隔离的 npm 与 Bun 安装。
- 本地发布安装、文档中的 npm 安装，以及 `pi update --self`，在支持时使用 `--ignore-scripts`。
- CI 使用 `npm ci --ignore-scripts` 安装；定时 GitHub workflow 会运行 `npm audit --omit=dev` 与 `npm audit signatures --omit=dev`。
- Shrinkwrap 生成对依赖生命周期脚本有明确白名单；新增带生命周期脚本的依赖在审阅前会使检查失败。

## 分享你的开源 coding agent 会话

若你使用 Pi 或其他 coding agent 做开源工作，请分享你的会话。

公开的 OSS 会话数据有助于用真实世界的任务、工具使用、失败与修复来改进 coding agent，而不是玩具基准。

完整说明见 [这篇 X 帖子](https://x.com/badlogicgames/status/2037811643774652911)。

发布会话请使用 [`badlogic/pi-share-hf`](https://github.com/badlogic/pi-share-hf)。阅读其 README.md 了解设置说明。你只需要一个 Hugging Face 账号、Hugging Face CLI 以及 `pi-share-hf`。

你也可以观看 [这个视频](https://x.com/badlogicgames/status/2041151967695634619)，其中演示了我如何发布自己的 `pi-mono` 会话。

我定期将自己的 `pi-mono` 工作会话发布在此：

- [badlogicgames/pi-mono on Hugging Face](https://huggingface.co/datasets/badlogicgames/pi-mono)

## 许可证

MIT

<p align="center">
  <a href="https://pi.dev">pi.dev</a> domain graciously donated by
  <br /><br />
  <a href="https://exe.dev"><img src="packages/coding-agent/docs/images/exy.png" alt="Exy mascot" width="48" /><br />exe.dev</a>
</p>
