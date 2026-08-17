# 环境变量

Pi 以三种方式使用环境变量：

- 诸如 `PI_OFFLINE` 的变量用于配置 Pi 进程本身。
- Pi 会设置 `PI_CODING_AGENT`，以便子进程能检测到自己运行在 Pi 内。
- 由 LLM 可调用的 bash 工具运行的命令会收到描述当前会话的 `PI_*` 变量。

提供商 API 密钥变量另见 [提供商](providers.md#environment-variables-or-auth-file)。

## 进程标记

CLI 与 RPC 入口会设置 `PI_CODING_AGENT=true`。子进程会继承它，并可用其检测自己是否运行在 Pi 内。它不是会话相关的，通过 SDK 嵌入 Pi 时也不会自动设置。

## Bash 工具会话环境

由 bash 工具运行的命令会收到当前 Pi 会话状态：

| 变量 | 说明 |
|----------|-------------|
| `PI_SESSION_ID` | 当前会话 ID |
| `PI_SESSION_FILE` | 当前会话 JSONL 文件的绝对路径；临时会话时不设置 |
| `PI_PROVIDER` | 当前选中的模型提供商 |
| `PI_MODEL` | 当前选中的模型 ID |
| `PI_REASONING_LEVEL` | 当前有效的推理级别：`off`、`minimal`、`low`、`medium`、`high`、`xhigh` 或 `max` |

这些值在每条命令启动时解析。因此切换模型或更改推理级别会影响下一条 bash 命令，无需重启 Pi。`PI_PROVIDER` 与 `PI_MODEL` 标识的是所选的 Pi 模型，而不是 router 内部可能选择的另一个上游模型。

当被问及当前运行的是哪个模型或提供商时，请检查这些变量，而不是从系统提示中推断：

```bash
printf '%s/%s\n' "$PI_PROVIDER" "$PI_MODEL"
printf 'reasoning=%s session=%s\n' "$PI_REASONING_LEVEL" "$PI_SESSION_ID"
```

会话为持久会话时可直接检查会话文件：

```bash
if [ -n "$PI_SESSION_FILE" ]; then
  tail -n 1 "$PI_SESSION_FILE"
fi
```

这些变量会注入到 LLM 可调用的 bash 工具中。不会注入到用户输入的 `!` 或 `!!` 命令中。

### 自定义 Bash 工具

用 `createBashTool()` 创建并注册到 Pi 的 bash 工具默认会暴露会话环境。注入发生在 `spawnHook` 之前，因此 hook 可在 `ctx.env` 中收到这些变量：

```typescript
const bashTool = createBashTool(cwd, {
  spawnHook: (ctx) => ({
    ...ctx,
    env: { ...ctx.env, CI: "1" },
  }),
});
```

可独立于 spawn hook 禁用会话元数据：

```typescript
const bashTool = createBashTool(cwd, {
  exposeSessionEnvironment: false,
  spawnHook: (ctx) => ctx,
});
```

禁用时，Pi 会移除这些变量的继承值，以免嵌套的 Pi 进程暴露过期的父会话元数据。

## Pi 进程配置

这些变量由 Pi 自身读取：

| 变量 | 说明 |
|----------|-------------|
| `PI_CODING_AGENT_DIR` | 覆盖配置目录；默认为 `~/.pi/agent` |
| `PI_CODING_AGENT_SESSION_DIR` | 覆盖会话存储；会被 `--session-dir` 覆盖 |
| `PI_PACKAGE_DIR` | 覆盖包目录，适用于 Nix/Guix store 路径 |
| `PI_OFFLINE` | 禁用启动时的网络操作，包括更新检查、包更新与安装/更新遥测 |
| `PI_SKIP_VERSION_CHECK` | 禁用向 `pi.dev` 请求最新版本 |
| `PI_TELEMETRY` | 覆盖安装/更新遥测与提供商标识头：`1`/`true`/`yes` 或 `0`/`false`/`no` |
| `PI_CACHE_RETENTION` | 设为 `long` 以在支持时启用更长的提供商提示缓存 |
| `PI_SHARE_VIEWER_URL` | 覆盖 `/share` 使用的基础 URL |
| `PI_HARDWARE_CURSOR` | 设为 `1` 以显示硬件光标；见 [终端设置](terminal-setup.md) |
| `VISUAL`、`EDITOR` | 未设置 `externalEditor` 时的外部编辑器回退 |
| `HTTP_PROXY`、`HTTPS_PROXY` | 代理出站 HTTP 请求 |

诸如 `ANTHROPIC_API_KEY`、`OPENAI_API_KEY` 以及云提供商配置等凭证列在 [提供商](providers.md#environment-variables-or-auth-file)。
