# 扩展示例

pi-coding-agent 的示例扩展。

## 用法

```bash
# Load an extension with --extension flag
pi --extension examples/extensions/permission-gate.ts

# Or copy to extensions directory for auto-discovery
cp permission-gate.ts ~/.pi/agent/extensions/
```

## 示例

### 生命周期与安全

| 扩展 | 说明 |
|------|------|
| `permission-gate.ts` | 在危险 bash 命令（rm -rf、sudo 等）执行前请求确认 |
| `project-trust.ts` | 演示针对用户/全局与 CLI 扩展的 `project_trust` 事件 |
| `protected-paths.ts` | 阻止写入受保护路径（.env、.git/、node_modules/） |
| `confirm-destructive.ts` | 在破坏性会话操作（clear、switch、fork）前确认 |
| `dirty-repo-guard.ts` | 在有未提交 git 更改时阻止会话变更 |
| `sandbox/` | 使用 `@anthropic-ai/sandbox-runtime` 的操作系统级沙箱，支持按项目配置 |
| `gondolin/` | 将内置工具与 `!` 命令路由到 Gondolin 微虚拟机 |

### 自定义工具

| 扩展 | 说明 |
|------|------|
| `todo.ts` | 待办列表工具 + `/todos` 命令，含自定义渲染与状态持久化 |
| `hello.ts` | 最小自定义工具示例 |
| `question.ts` | 演示用 `ctx.ui.select()` 以自定义 UI 向用户提问 |
| `questionnaire.ts` | 多问题输入，通过标签栏在问题间导航 |
| `tool-override.ts` | 覆盖内置工具（例如为 `read` 增加日志/访问控制） |
| `dynamic-tools.ts` | 在启动后（`session_start`）以及通过命令在运行时注册工具，含提示词片段与工具专用提示词指南 |
| `kimi-deferred-tools.ts` | 为 Kimi 的延迟工具加载协议搜索并逐步激活工具 |
| `structured-output.ts` | 最终结构化输出工具，返回 `terminate: true`，使 agent 可在该工具调用上结束 |
| `built-in-tool-renderer.ts` | 为内置工具（read、bash、edit、write）提供自定义紧凑渲染，同时保留原有行为 |
| `minimal-mode.ts` | 覆盖内置工具渲染以实现极简显示（折叠模式下仅显示工具调用、不显示输出） |
| `truncated-tool.ts` | 封装 ripgrep，并正确截断输出（50KB/2000 行） |
| `ssh.ts` | 通过可插拔操作经 SSH 将所有工具委托到远程机器 |
| `subagent/` | 将任务委托给具有隔离上下文窗口的专用子代理 |

### 命令与 UI

| 扩展 | 说明 |
|------|------|
| `preset.ts` | 通过 `--preset` 标志与 `/preset` 命令，为模型、思考级别、工具与指令提供命名预设 |
| `plan-mode/` | Claude Code 风格的计划模式，用于只读探索，含 `/plan` 命令与步骤跟踪 |
| `tools.ts` | 交互式 `/tools` 命令，启用/禁用工具并持久化到会话 |
| `handoff.ts` | 通过 `/handoff <goal>` 将上下文转移到新的聚焦会话 |
| `qna.ts` | 通过 `ctx.ui.setEditorText()` 从上一轮回复中提取问题到编辑器 |
| `status-line.ts` | 通过 `ctx.ui.setStatus()` 在页脚显示回合进度，带主题色 |
| `github-issue-autocomplete.ts` | 通过堆叠自定义自动补全提供商添加 `#1234` issue 补全，并从 `gh issue list` 预加载未关闭 issue |
| `widget-placement.ts` | 通过 `ctx.ui.setWidget()` 的 placement 在编辑器上方与下方显示 widget |
| `hidden-thinking-label.ts` | 通过 `ctx.ui.setHiddenThinkingLabel()` 自定义折叠思考标签 |
| `working-indicator.ts` | 通过 `ctx.ui.setWorkingIndicator()` 自定义流式工作指示器 |
| `model-status.ts` | 通过 `model_select` 钩子在状态栏显示模型变更 |
| `snake.ts` | 贪吃蛇游戏，含自定义 UI、键盘处理与会话持久化 |
| `tic-tac-toe.ts` | 与 agent 对战的井字棋，工具使用 `executionMode: "sequential"` 以避免共享光标状态上的竞态 |
| `hi.ts` | 最小斜杠命令示例：`/hi [args]` 通过 `sendUserMessage` 发送 `hi` + 参数 |
| `send-user-message.ts` | 演示从扩展发送用户消息的 `pi.sendUserMessage()` |
| `timed-confirm.ts` | 演示用 AbortSignal 自动关闭 `ctx.ui.confirm()` 与 `ctx.ui.select()` 对话框 |
| `rpc-demo.ts` | 练习所有支持 RPC 的扩展 UI 方法；可与 [`examples/rpc-extension-ui.ts`](../rpc-extension-ui.ts) 配合使用 |
| `modal-editor.ts` | 通过 `ctx.ui.setEditorComponent()` 实现类似 vim 的模态编辑器 |
| `rainbow-editor.ts` | 通过自定义编辑器实现动画彩虹文字效果 |
| `notify.ts` | agent 完成时通过 OSC 777 发送桌面通知（Ghostty、iTerm2、WezTerm） |
| `titlebar-spinner.ts` | agent 工作时在终端标题中显示 Braille 旋转动画 |
| `summarize.ts` | 用 GPT-5.2 总结对话并显示在瞬时 UI 中 |
| `custom-footer.ts` | 通过 `ctx.ui.setFooter()` 自定义页脚，显示 git 分支与 token 统计 |
| `custom-header.ts` | 通过 `ctx.ui.setHeader()` 自定义页眉 |
| `overlay-test.ts` | 用内联文本输入与边界情况测试浮层合成 |
| `overlay-qa-tests.ts` | 全面的浮层 QA 测试：锚点、边距、堆叠、溢出、动画 |
| `doom-overlay/` | 以浮层形式运行 DOOM，35 FPS（演示实时游戏渲染） |
| `shutdown-command.ts` | 添加 `/quit` 命令，演示 `ctx.shutdown()` |
| `reload-runtime.ts` | 添加 `/reload-runtime` 与 `reload_runtime` 工具，展示安全重载流程 |
| `interactive-shell.ts` | 通过 `user_bash` 钩子在完整终端中运行交互式命令（vim、htop） |
| `inline-bash.ts` | 通过 `input` 事件转换展开提示词中的 `!{command}` 模式 |
| `input-transform-streaming.ts` | 通过 `streamingBehavior` 在流式中途转向时跳过昂贵的输入预处理 |

### Git 集成

| 扩展 | 说明 |
|------|------|
| `git-checkpoint.ts` | 在每轮创建 git stash 检查点，以便 fork 时恢复代码 |
| `auto-commit-on-exit.ts` | 退出时自动提交，使用最后一条助手消息作为提交信息 |

### 系统提示词与压缩

| 扩展 | 说明 |
|------|------|
| `pirate.ts` | 演示用 `systemPromptAppend` 动态修改系统提示词 |
| `claude-rules.ts` | 扫描 `.claude/rules/` 文件夹，并在系统提示词中列出规则 |
| `custom-compaction.ts` | 自定义压缩，总结整段对话 |
| `trigger-compact.ts` | 当上下文用量超过 100k tokens 时触发压缩，并添加 `/trigger-compact` 命令 |

### 系统集成

| 扩展 | 说明 |
|------|------|
| `mac-system-theme.ts` | 将 pi 主题与 macOS 深色/浅色模式同步 |

### 资源

| 扩展 | 说明 |
|------|------|
| `dynamic-resources/` | 使用 `resources_discover` 加载 skills、提示词与主题 |

### 消息与通信

| 扩展 | 说明 |
|------|------|
| `message-renderer.ts` | 通过 `registerMessageRenderer` 自定义消息渲染，含颜色与可展开详情 |
| `entry-renderer.ts` | 通过 `appendEntry` 与 `registerEntryRenderer` 实现仅 TUI 的会话条目渲染 |
| `event-bus.ts` | 通过 `pi.events` 进行扩展间通信 |

### 会话元数据

| 扩展 | 说明 |
|------|------|
| `session-name.ts` | 通过 `setSessionName` 为会话选择器命名会话 |
| `bookmark.ts` | 通过 `setLabel` 为条目添加标签，便于 `/tree` 导航 |

### 自定义提供商

| 扩展 | 说明 |
|------|------|
| `custom-provider-anthropic/` | 自定义 Anthropic 提供商，支持 OAuth 与自定义流式实现 |
| `custom-provider-gitlab-duo/` | GitLab Duo 提供商，通过代理使用 pi-ai 内置的 Anthropic/OpenAI 流式传输 |
| `custom-provider-zenmux/` | ZenMux（OpenAI 兼容）提供商：远程模型发现 + `refreshModels`（入门学习用） |

### 外部依赖

| 扩展 | 说明 |
|------|------|
| `with-deps/` | 拥有自己的 package.json 与依赖的扩展（演示 jiti 模块解析） |
| `file-trigger.ts` | 监视触发文件，并将其内容注入对话 |

## 编写扩展

完整文档见 [docs/extensions.md](../../docs/extensions.md)。

```typescript
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

export default function (pi: ExtensionAPI) {
  // Subscribe to lifecycle events
  pi.on("tool_call", async (event, ctx) => {
    if (event.toolName === "bash" && event.input.command?.includes("rm -rf")) {
      const ok = await ctx.ui.confirm("Dangerous!", "Allow rm -rf?");
      if (!ok) return { block: true, reason: "Blocked by user" };
    }
  });

  // Register custom tools
  pi.registerTool({
    name: "greet",
    label: "Greeting",
    description: "Generate a greeting",
    parameters: Type.Object({
      name: Type.String({ description: "Name to greet" }),
    }),
    async execute(toolCallId, params, signal, onUpdate, ctx) {
      return {
        content: [{ type: "text", text: `Hello, ${params.name}!` }],
        details: {},
      };
    },
  });

  // Register commands
  pi.registerCommand("hello", {
    description: "Say hello",
    handler: async (args, ctx) => {
      ctx.ui.notify("Hello!", "info");
    },
  });
}
```

## 关键模式

**字符串参数使用 StringEnum**（Google API 兼容性所必需）：
```typescript
import { StringEnum } from "@earendil-works/pi-ai";

// Good
action: StringEnum(["list", "add"] as const)

// Bad - doesn't work with Google
action: Type.Union([Type.Literal("list"), Type.Literal("add")])
```

**通过 details 持久化状态：**
```typescript
// Store state in tool result details for proper forking support
return {
  content: [{ type: "text", text: "Done" }],
  details: { todos: [...todos], nextId },  // Persisted in session
};

// Reconstruct on session events
pi.on("session_start", async (_event, ctx) => {
  for (const entry of ctx.sessionManager.getBranch()) {
    if (entry.type === "message" && entry.message.toolName === "my_tool") {
      const details = entry.message.details;
      // Reconstruct state from details
    }
  }
});
```
