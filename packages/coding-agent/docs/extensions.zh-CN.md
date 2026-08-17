> pi 可以创建扩展。请它为你特定的使用场景构建一个扩展。

# 扩展

扩展是用 TypeScript 编写的模块，用于增强 pi 的行为。它们可以订阅生命周期事件、注册 LLM 可调用的自定义工具、添加命令等。

> **`/reload` 的放置位置：** 将扩展置于 `~/.pi/agent/extensions/`（全局）或 `.pi/extensions/`（项目本地）目录中，即可实现自动发现。仅在快速测试时使用 `pi -e ./path.ts`。位于自动发现路径中的扩展可通过 `/reload` 命令热重载。

**核心能力：**
- **自定义工具** —— 通过 `pi.registerTool()` 注册 LLM 可调用的工具  
- **事件拦截** —— 阻止或修改工具调用、注入上下文、自定义对话压缩逻辑  
- **用户交互** —— 通过 `ctx.ui`（如 `select`、`confirm`、`input`、`notify`）向用户发起提示  
- **自定义 UI 组件** —— 使用 `ctx.ui.custom()` 构建完整的 TUI 组件，支持键盘输入，适用于复杂交互  
- **自定义命令** —— 通过 `pi.registerCommand()` 注册类似 `/mycommand` 的命令  
- **会话持久化** —— 通过 `pi.appendEntry()` 存储可在重启后保留的状态  
- **自定义渲染** —— 控制工具调用/结果及消息在 TUI 中的显示方式  

**典型使用场景示例：**
- 权限闸门（例如在执行 `rm -rf`、`sudo` 等危险命令前要求确认）  
- Git 检查点（每轮对话自动 `stash`，切换分支时恢复）  
- 路径保护（禁止向 `.env`、`node_modules/` 等敏感路径写入）  
- 自定义对话压缩（按你的方式总结对话内容）  
- 对话摘要（参见 `summarize.ts` 示例）  
- 交互式工具（提问、向导、自定义对话框）  
- 有状态工具（待办事项列表、连接池）  
- 外部集成（文件监听器、Webhook、CI 触发器）  
- 等待期间的小游戏（参见 `snake.ts` 示例）  

完整可运行的实现请参阅 [examples/extensions/](../examples/extensions/) 目录。

## 目录

- [快速开始](#quick-start)  
- [扩展存放位置](#extension-locations)  
- [可用导入项](#available-imports)  
- [编写扩展](#writing-an-extension)  
  - [扩展风格](#extension-styles)  
- [事件](#events)  
  - [生命周期概览](#lifecycle-overview)  
  - [资源事件](#resource-events)  
  - [会话事件](#session-events)  
  - [智能体事件](#agent-events)  
  - [模型事件](#model-events)  
  - [工具事件](#tool-events)  
- [ExtensionContext](#extensioncontext)  
- [ExtensionCommandContext](#extensioncommandcontext)  
- [ExtensionAPI 方法](#extensionapi-methods)  
- [状态管理](#state-management)  
- [自定义工具](#custom-tools)  
  - [动态工具加载](#dynamic-tool-loading)  
- [自定义 UI](#custom-ui)  
- [错误处理](#error-handling)  
- [模式行为](#mode-behavior)  
- [示例参考](#examples-reference)  

## 快速开始

创建文件 `~/.pi/agent/extensions/my-extension.ts`：

```typescript
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

export default function (pi: ExtensionAPI) {
  // React to events
  pi.on("session_start", async (_event, ctx) => {
    ctx.ui.notify("Extension loaded!", "info");
  });

  pi.on("tool_call", async (event, ctx) => {
    if (event.toolName === "bash" && event.input.command?.includes("rm -rf")) {
      const ok = await ctx.ui.confirm("Dangerous!", "Allow rm -rf?");
      if (!ok) return { block: true, reason: "Blocked by user" };
    }
  });

  // Register a custom tool
  pi.registerTool({
    name: "greet",
    label: "Greet",
    description: "Greet someone by name",
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

  // Register a command
  pi.registerCommand("hello", {
    description: "Say hello",
    handler: async (args, ctx) => {
      ctx.ui.notify(`Hello ${args || "world"}!`, "info");
    },
  });
}
```

使用 `--extension`（或 `-e`）标志进行测试：

```bash
pi -e ./my-extension.ts
```

## 扩展存放位置

> **安全性说明：** 扩展以你的完整系统权限运行，可执行任意代码。请仅从你信任的来源安装扩展。

扩展将从受信任的位置自动发现。项目本地的 `.pi/extensions` 目录中的扩展，仅在项目被标记为“已信任”后才会加载。

| 位置 | 作用域 |
|------|--------|
| `~/.pi/agent/extensions/*.ts` | 全局（所有项目） |
| `~/.pi/agent/extensions/*/index.ts` | 全局（子目录形式） |
| `.pi/extensions/*.ts` | 项目本地 |
| `.pi/extensions/*/index.ts` | 项目本地（子目录形式） |

还可通过 `settings.json` 配置额外路径：

```json
{
  "packages": [
    "npm:@foo/bar@1.0.0",
    "git:github.com/user/repo@v1"
  ],
  "extensions": [
    "/path/to/local/extension.ts",
    "/path/to/local/extension/dir"
  ]
}
```

如需通过 npm 或 git 分发 pi 扩展包，请参阅 [packages.md](packages.md)。

## 可用导入项

| 包名 | 用途 |
|------|------|
| `@earendil-works/pi-coding-agent` | 扩展类型定义（如 `ExtensionAPI`、`ExtensionContext`、各类事件） |
| `typebox` | 工具参数的 Schema 定义 |
| `@earendil-works/pi-ai` | AI 工具函数（例如 `StringEnum`，兼容 Google 风格枚举） |
| `@earendil-works/pi-tui` | 用于自定义渲染的 TUI 组件 |

npm 依赖同样可用。只需在扩展文件旁（或其父级目录中）添加 `package.json`，运行 `npm install` 后，对 `node_modules/` 的导入将被自动解析。

对于通过 `pi install`（npm 或 git 方式）安装的分布式 pi 包，其运行时依赖必须声明在 `dependencies` 字段中。包安装默认采用生产环境安装（`npm install --omit=dev`），因此 `devDependencies` 在运行时不可用；当配置了 `npmCommand` 时，git 包将使用基础 `install` 命令以确保与各类封装工具兼容。

Node.js 内置模块（如 `node:fs`、`node:path` 等）亦可直接使用。

## 编写扩展

扩展导出一个默认的工厂函数，该函数接收 `ExtensionAPI` 参数。该工厂函数可以是同步的，也可以是异步的：

```typescript
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  // Subscribe to events
  pi.on("event_name", async (event, ctx) => {
    // ctx.ui for user interaction
    const ok = await ctx.ui.confirm("Title", "Are you sure?");
    ctx.ui.notify("Done!", "info");
    ctx.ui.setStatus("my-ext", "Processing...");  // Footer status
    ctx.ui.setWidget("my-ext", ["Line 1", "Line 2"]);  // Widget above editor (default)
  });

  // Register tools, commands, shortcuts, flags
  pi.registerTool({ ... });
  pi.registerCommand("name", { ... });
  pi.registerShortcut("ctrl+x", { ... });
  pi.registerFlag("my-flag", { ... });
}
```

扩展通过 [jiti](https://github.com/unjs/jiti) 加载，因此 TypeScript 无需编译即可直接运行。

若工厂函数返回一个 `Promise`，pi 将等待其完成后再继续启动流程。这意味着异步初始化会在 `session_start` 之前、`resources_discover` 之前，以及通过 `pi.registerProvider()` 注册并排队的提供者（provider）注册操作被刷新（flush）之前全部完成。

### 异步工厂函数

对一次性启动任务（例如获取远程配置或动态发现可用模型）应使用异步工厂函数。

```typescript
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default async function (pi: ExtensionAPI) {
  const response = await fetch("http://localhost:1234/v1/models");
  const payload = (await response.json()) as {
    data: Array<{
      id: string;
      name?: string;
      context_window?: number;
      max_tokens?: number;
    }>;
  };

  pi.registerProvider("local-openai", {
    baseUrl: "http://localhost:1234/v1",
    apiKey: "$LOCAL_OPENAI_API_KEY",
    api: "openai-completions",
    models: payload.data.map((model) => ({
      id: model.id,
      name: model.name ?? model.id,
      reasoning: false,
      input: ["text"],
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
      contextWindow: model.context_window ?? 128000,
      maxTokens: model.max_tokens ?? 4096,
    })),
  });
}
```

该模式可确保所获取的模型在常规启动过程中及执行 `pi --list-models` 命令时均可用。

### 长生命周期资源与关闭处理

扩展工厂函数可能在从未启动会话的调用中运行。请勿在工厂函数中启动后台资源（例如进程、套接字、文件监听器或定时器）。

请将后台资源的启动延迟至 `session_start` 事件触发时，或延迟至实际需要该资源的命令/工具/事件发生时。注册一个幂等（idempotent）的 `session_shutdown` 处理器，用于关闭你在会话期间启动的所有会话作用域资源。

### 扩展组织风格

**单文件形式** —— 最简单，适用于小型扩展：

```
~/.pi/agent/extensions/
└── my-extension.ts
```

**含 `index.ts` 的目录结构** —— 适用于多文件扩展：

```
~/.pi/agent/extensions/
└── my-extension/
    ├── index.ts        # Entry point (exports default function)
    ├── tools.ts        # Helper module
    └── utils.ts        # Helper module
```

**含依赖的包形式** —— 适用于需引入 npm 包的扩展：

```
~/.pi/agent/extensions/
└── my-extension/
    ├── package.json    # Declares dependencies and entry points
    ├── package-lock.json
    ├── node_modules/   # After npm install
    └── src/
        └── index.ts
```

```json
// package.json
{
  "name": "my-extension",
  "dependencies": {
    "zod": "^3.0.0",
    "chalk": "^5.0.0"
  },
  "pi": {
    "extensions": ["./src/index.ts"]
  }
}
```

在扩展目录中运行 `npm install`，之后对 `node_modules/` 中模块的导入将自动生效。

## 事件

### 生命周期概览

```
pi starts
  │
  ├─► project_trust (user/global and CLI extensions only, before project resources load)
  ├─► session_start { reason: "startup" }
  └─► resources_discover { reason: "startup" }
      │
      ▼
user sends prompt ─────────────────────────────────────────┐
  │                                                        │
  ├─► (extension commands checked first, bypass if found)  │
  ├─► input (can intercept, transform, or handle)          │
  ├─► (skill/template expansion if not handled)            │
  ├─► before_agent_start (can inject message, modify system prompt)
  ├─► agent_start                                          │
  ├─► message_start / message_update / message_end         │
  │                                                        │
  │   ┌─── turn (repeats while LLM calls tools) ───┐       │
  │   │                                            │       │
  │   ├─► turn_start                               │       │
  │   ├─► context (can modify messages)            │       │
  │   ├─► before_provider_headers (can mutate headers)     |
  │   ├─► before_provider_request (can inspect or replace payload)
  │   ├─► after_provider_response (status + headers, before stream consume)
  │   │                                            │       │
  │   │   LLM responds, may call tools:            │       │
  │   │     ├─► tool_execution_start               │       │
  │   │     ├─► tool_call (can block)              │       │
  │   │     ├─► tool_execution_update              │       │
  │   │     ├─► tool_result (can modify)           │       │
  │   │     └─► tool_execution_end                 │       │
  │   │                                            │       │
  │   └─► turn_end                                 │       │
  │                                                        │
  ├─► agent_end                                            │
  └─► agent_settled (no retry/compaction/follow-up left)   │
                                                           │
user sends another prompt ◄────────────────────────────────┘

/new (new session) or /resume (switch session)
  ├─► session_before_switch (can cancel)
  ├─► session_shutdown
  ├─► session_start { reason: "new" | "resume", previousSessionFile? }
  └─► resources_discover { reason: "startup" }

/fork or /clone
  ├─► session_before_fork (can cancel)
  ├─► session_shutdown
  ├─► session_start { reason: "fork", previousSessionFile }
  └─► resources_discover { reason: "startup" }

/name or pi.setSessionName()
  └─► session_info_changed

/compact or auto-compaction
  ├─► session_before_compact (can cancel or customize)
  └─► session_compact

/tree navigation
  ├─► session_before_tree (can cancel or customize)
  └─► session_tree

/model or Ctrl+P (model selection/cycling)
  ├─► thinking_level_select (if model change changes/clamps thinking level)
  └─► model_select

thinking level changes (settings, keybinding, pi.setThinkingLevel())
  └─► thinking_level_select

exit (Ctrl+C, Ctrl+D, SIGHUP, SIGTERM)
  └─► session_shutdown
```

### 启动事件

#### project_trust

在 pi 决定是否信任某项目（允许其使用动态配置，如 `.pi` 或 `.agents/skills`）之前触发。该事件在启动期间触发，也将在会话替换（例如执行 `/resume`）进入当前进程中尚未解析过信任状态的当前工作目录（cwd）时触发。仅用户级/全局扩展及 CLI `-e` 指定的扩展参与此事件；项目本地扩展将在信任判定完成后才被加载。

```typescript
pi.on("project_trust", async (event, ctx) => {
  // event.cwd - current working directory
  // ctx has a limited trust context: cwd, mode, hasUI, and select/confirm/input/notify UI helpers
  if (await ctx.ui.confirm("Trust project?", event.cwd)) {
    return { trusted: "yes", remember: true };
  }
  return { trusted: "undecided" };
});
```

`project_trust` 处理器必须返回 `{ trusted: "yes" | "no" | "undecided" }`。若用户级/全局扩展或 CLI 扩展返回 `"yes"` 或 `"no"`，则该决定即为最终裁决；首个 `"yes"` 或 `"no"` 返回值胜出，并抑制内置的信任提示。使用 `remember: true` 可持久化 `"yes"` 或 `"no"` 的决策；否则该决策仅对当前进程有效。返回 `"undecided"` 表示将决策权交由后续处理器或内置信任流程处理。在发起提示前，请检查 `ctx.hasUI`。若无任何处理器返回 `"yes"` 或 `"no"`，则按常规流程进行信任判定：首先应用已保存的 `trust.json` 决策，随后由 `defaultProjectTrust` 控制 pi 默认行为（询问、信任或拒绝）。

### 资源事件

#### resources_discover

在 `session_start` 之后触发，使扩展可贡献额外的技能（skill）、提示（prompt）和主题（theme）路径。  
启动时触发该事件的 `reason` 字段值为 `"startup"`；重载时则为 `"reload"`。

```typescript
pi.on("resources_discover", async (event, _ctx) => {
  // event.cwd - current working directory
  // event.reason - "startup" | "reload"
  return {
    skillPaths: ["/path/to/skills"],
    promptPaths: ["/path/to/prompts"],
    themePaths: ["/path/to/themes"],
  };
});
```

### 会话事件

有关会话存储内部机制及 SessionManager API，请参阅 [会话格式（Session Format）](session-format.md)。

#### session_start

当会话被启动、加载或重新加载时触发。

```typescript
pi.on("session_start", async (event, ctx) => {
  // event.reason - "startup" | "reload" | "new" | "resume" | "fork"
  // event.previousSessionFile - present for "new", "resume", and "fork"
  ctx.ui.notify(`Session: ${ctx.sessionManager.getSessionFile() ?? "ephemeral"}`, "info");
});
```

#### session_info_changed

当通过 `/name` 命令、RPC 或 `pi.setSessionName()` 设置当前会话显示名称时触发。

```typescript
pi.on("session_info_changed", async (event, ctx) => {
  // event.name - current normalized name, or undefined if cleared
  ctx.ui.notify(`Session renamed: ${event.name ?? "(none)"}`, "info");
});
```

#### session_before_switch

在启动新会话（`/new`）或切换会话（`/resume`）之前触发。

```typescript
pi.on("session_before_switch", async (event, ctx) => {
  // event.reason - "new" or "resume"
  // event.targetSessionFile - session we're switching to (only for "resume")

  if (event.reason === "new") {
    const ok = await ctx.ui.confirm("Clear?", "Delete all messages?");
    if (!ok) return { cancel: true };
  }
});
```

成功完成切换或新建会话操作后，pi 将向旧扩展实例发出 `session_shutdown` 事件，然后为新会话重新加载并重新绑定所有扩展，最后以 `reason: "new" | "resume"` 和 `previousSessionFile` 参数发出 `session_start` 事件。  
请在 `session_shutdown` 中执行清理工作，并在 `session_start` 中重建任何内存中的状态。

#### session_before_fork

在通过 `/fork` 分叉或通过 `/clone` 克隆会话时触发。

```typescript
pi.on("session_before_fork", async (event, ctx) => {
  // event.entryId - ID of the selected entry
  // event.position - "before" for /fork, "at" for /clone
  return { cancel: true }; // Cancel fork/clone
  // OR
  return { skipConversationRestore: true }; // Reserved for future conversation restore control
});
```

成功完成分叉或克隆操作后，pi 将向旧扩展实例发出 `session_shutdown` 事件，然后为新会话重新加载并重新绑定所有扩展，最后以 `reason: "fork"` 和 `previousSessionFile` 参数发出 `session_start` 事件。  
请在 `session_shutdown` 中执行清理工作，并在 `session_start` 中重建任何内存中的状态。

#### session_before_compact / session_compact

在压缩（compaction）操作期间触发。详情请参阅 [compaction.md](compaction.md)。

```typescript
pi.on("session_before_compact", async (event, ctx) => {
  const { preparation, branchEntries, customInstructions, reason, willRetry, signal } = event;

  // reason - "manual" (/compact), "threshold", or "overflow"
  // willRetry - whether the aborted turn is retried after compaction (overflow recovery)

  // Cancel:
  return { cancel: true };

  // Custom summary:
  return {
    compaction: {
      summary: "...",
      firstKeptEntryId: preparation.firstKeptEntryId,
      tokensBefore: preparation.tokensBefore,
      // usage: summaryResponse.usage, // Optional; included in session totals
    }
  };
});

pi.on("session_compact", async (event, ctx) => {
  // event.compactionEntry - the saved compaction
  // event.fromExtension - whether extension provided it
  // event.reason - "manual" (/compact), "threshold", or "overflow"
  // event.willRetry - whether the aborted turn is retried after compaction (overflow recovery)
});
```

#### session_before_tree / session_tree

在执行 `/tree` 导航时触发。有关树形导航概念，请参阅 [会话（Sessions）](sessions.md)。

```typescript
pi.on("session_before_tree", async (event, ctx) => {
  const { preparation, signal } = event;
  return { cancel: true };
  // OR provide custom summary:
  return {
    summary: {
      summary: "...",
      // usage: summaryResponse.usage, // Optional; included in session totals
      details: {},
    },
  };
});

pi.on("session_tree", async (event, ctx) => {
  // event.newLeafId, oldLeafId, summaryEntry, fromExtension
});
```

#### session_shutdown

在已启动的会话运行时被销毁前触发。请使用此钩子清理由 `session_start` 或其他会话作用域钩子所打开的资源。

```typescript
pi.on("session_shutdown", async (event, ctx) => {
  // event.reason - "quit" | "reload" | "new" | "resume" | "fork"
  // event.targetSessionFile - destination session for session replacement flows
  // Cleanup, save state, etc.
});
```

### Agent 事件

#### before_agent_start

在用户提交提示词后、Agent 循环开始前触发。可注入一条消息和/或修改系统提示词（system prompt）。

```typescript
pi.on("before_agent_start", async (event, ctx) => {
  // event.prompt - user's prompt text
  // event.images - attached images (if any)
  // event.systemPrompt - current chained system prompt for this handler
  //   (includes changes from earlier before_agent_start handlers)
  // event.systemPromptOptions - structured options used to build the system prompt
  //   .customPrompt - any custom system prompt (from --system-prompt, SYSTEM.md, or custom templates)
  //   .selectedTools - tools currently active in the prompt
  //   .toolSnippets - one-line descriptions for each tool
  //   .promptGuidelines - custom guideline bullets
  //   .appendSystemPrompt - text from --append-system-prompt flags
  //   .cwd - working directory
  //   .contextFiles - AGENTS.md files and other loaded context files
  //   .skills - loaded skills

  return {
    // Inject a persistent message (stored in session, sent to LLM)
    message: {
      customType: "my-extension",
      content: "Additional context for the LLM",
      display: true,
    },
    // Replace the system prompt for this turn (chained across extensions)
    systemPrompt: event.systemPrompt + "\n\nExtra instructions for this turn...",
  };
});
```

`systemPromptOptions` 字段使扩展能够访问 Pi 用于构建系统提示词所使用的相同结构化数据。这使你能够检查 Pi 当前已加载的内容——包括自定义提示词、指南、工具代码片段、上下文文件、技能等——而无需重新发现资源或重新解析命令行参数。当你的扩展需要在尊重用户配置的前提下，对系统提示词做出深度且有依据的修改时，请使用该字段。

在 `before_agent_start` 中，`event.systemPrompt` 和 `ctx.getSystemPrompt()` 均反映当前处理器执行完毕后的链式系统提示词。后续的 `before_agent_start` 处理器仍可再次对其进行修改。

#### agent_start / agent_end / agent_settled

`agent_start` 在底层 Agent 运行开始时触发；`agent_end` 在该次运行结束时触发，但 Pi 可能仍会自动重试、自动压缩并重试，或继续处理队列中待执行的后续消息。若需集成状态信息，并确保 Pi 不会再自动继续运行，请使用 `agent_settled`。

```typescript
pi.on("agent_start", async (_event, ctx) => {});

pi.on("agent_end", async (event, ctx) => {
  // event.messages - messages from this low-level run
});

pi.on("agent_settled", async (_event, ctx) => {
  // ctx.isIdle() is true here unless another extension started a new run.
});
```

#### turn_start / turn_end

每次“回合”（即一次大语言模型响应 + 相关工具调用）触发一次。

```typescript
pi.on("turn_start", async (event, ctx) => {
  // event.turnIndex, event.timestamp
});

pi.on("turn_end", async (event, ctx) => {
  // event.turnIndex, event.message, event.toolResults
});
```

#### message_start / message_update / message_end

在消息生命周期发生更新时触发。

- `message_start` 和 `message_end` 对用户消息、助手消息及工具结果消息均会触发；
- `message_update` 仅在助手流式输出更新时触发；
- `message_end` 处理器可返回 `{ message }` 对象以替换最终确定的消息；替换后的消息必须保持原有 `role` 字段不变。

```typescript
pi.on("message_start", async (event, ctx) => {
  // event.message
});

pi.on("message_update", async (event, ctx) => {
  // event.message
  // event.assistantMessageEvent (token-by-token stream event)
});

pi.on("message_end", async (event, ctx) => {
  if (event.message.role !== "assistant") return;

  return {
    message: {
      ...event.message,
      usage: {
        ...event.message.usage,
        cost: {
          ...event.message.usage.cost,
          total: 0.123,
        },
      },
    },
  };
});
```

#### tool_execution_start / tool_execution_update / tool_execution_end

在工具执行生命周期发生更新时触发。

在并行工具模式下：
- `tool_execution_start` 在预检阶段（preflight phase）按助手消息源顺序发出；
- `tool_execution_update` 事件可能在不同工具之间交错发生；
- `tool_execution_end` 在每个工具完成并最终确定后，按工具实际完成顺序发出；
- 最终的 `toolResult` 消息事件仍会在助手消息源顺序中稍后发出。

```typescript
pi.on("tool_execution_start", async (event, ctx) => {
  // event.toolCallId, event.toolName, event.args
});

pi.on("tool_execution_update", async (event, ctx) => {
  // event.toolCallId, event.toolName, event.args, event.partialResult
});

pi.on("tool_execution_end", async (event, ctx) => {
  // event.toolCallId, event.toolName, event.result, event.isError
});
```

#### context

在每次向大语言模型发起调用前触发。请以非破坏性方式修改消息。有关消息类型，请参阅 [会话格式文档](session-format.md)。

```typescript
pi.on("context", async (event, ctx) => {
  // event.messages - deep copy, safe to modify
  const filtered = event.messages.filter(m => !shouldPrune(m));
  return { messages: filtered };
});
```

#### before_provider_headers

在传出 HTTP 请求头组装完成后触发。可用于添加、覆盖或移除请求头。

处理器需就地修改 `event.headers` 对象：将某个键设为字符串表示添加或覆盖该头；设为 `null` 表示删除该头。

```typescript
pi.on("before_provider_headers", (event, ctx) => {
  // Add or override — e.g. a session id for gateway tracing/attribution
  event.headers["x-session-id"] = ctx.sessionManager.getSessionId();

  // Drop a tracking header pi adds for this call
  event.headers["X-OpenRouter-Title"] = null;
});
```

该钩子每发起一次 Provider 请求即运行一次；重试时复用相同的请求头，而不会再次触发该钩子。

#### before_provider_request

在构建完特定 Provider 的有效载荷（payload）之后、请求实际发出之前触发。处理器按扩展加载顺序依次执行。若返回 `undefined`，则保持原始 payload 不变；若返回其他任意值，则该值将作为新 payload 传递给后续处理器及实际请求。

该钩子可重写 Provider 级别的系统指令，甚至完全移除它们。这些针对 payload 层级的更改**不会**反映在 `ctx.getSystemPrompt()` 的返回值中，因为后者仅报告 Pi 所维护的系统提示词字符串，而非最终序列化后的 Provider payload。

```typescript
pi.on("before_provider_request", (event, ctx) => {
  console.log(JSON.stringify(event.payload, null, 2));

  // Optional: replace payload
  // return { ...event.payload, temperature: 0 };
});
```

该钩子主要用于调试 Provider 序列化行为及缓存机制。

#### after_provider_response

在接收到 HTTP 响应之后、其流式响应体（stream body）被消费之前触发。处理器按扩展加载顺序依次执行。

```typescript
pi.on("after_provider_response", (event, ctx) => {
  // event.status - HTTP status code
  // event.headers - normalized response headers
  if (event.status === 429) {
    console.log("rate limited", event.headers["retry-after"]);
  }
});
```

响应头的可用性取决于具体 Provider 及传输层实现。某些对 HTTP 响应进行了抽象封装的 Provider 可能不暴露响应头。

### 模型事件

#### model_select

当模型通过 `/model` 命令、模型轮换（`Ctrl+P`）或会话恢复等方式发生变更时触发。

```typescript
pi.on("model_select", async (event, ctx) => {
  // event.model - newly selected model
  // event.previousModel - previous model (undefined if first selection)
  // event.source - "set" | "cycle" | "restore"

  const prev = event.previousModel
    ? `${event.previousModel.provider}/${event.previousModel.id}`
    : "none";
  const next = `${event.model.provider}/${event.model.id}`;

  ctx.ui.notify(`Model changed (${event.source}): ${prev} -> ${next}`, "info");
});
```

可用于在活跃模型变更时更新 UI 元素（如状态栏、页脚），或执行与特定模型相关的初始化操作。

#### thinking_level_select

当思维层级（thinking level）发生变化时触发。该事件仅为通知用途；处理器的返回值将被忽略。

```typescript
pi.on("thinking_level_select", async (event, ctx) => {
  // event.level - newly selected thinking level
  // event.previousLevel - previous thinking level

  ctx.ui.setStatus("thinking", `thinking: ${event.level}`);
});
```

可用于在调用 `pi.setThinkingLevel()`、模型变更或内置思维层级控件改变当前思维层级时，同步更新扩展的 UI。

### 工具事件

#### tool_call

在 `tool_execution_start` 触发之后、工具实际执行之前触发。**该事件可阻塞执行流程。** 可使用 `isToolCallEventType` 类型守卫来缩小事件类型范围，并获取类型安全的输入参数。在 `tool_call` 运行之前，`pi` 会等待此前已发出的 Agent 事件完成通过 `AgentSession` 的“排空”（draining）过程。这意味着 `ctx.sessionManager` 在当前助手发起工具调用的消息范围内是最新、同步的。

在默认的并行工具执行模式下，来自同一助手消息的同级（sibling）工具调用会**按顺序进行预检（preflight）**，然后**并发执行**。因此，`tool_call` **无法保证**在 `ctx.sessionManager` 中看到同一助手消息中其他同级工具调用的执行结果。

`event.input` 是可变的。请就地（in place）修改它，以在工具执行前修补工具参数。

行为保证：
- 对 `event.input` 的修改会影响实际的工具执行；
- 后续的 `tool_call` 处理器能看到先前处理器所作的修改；
- 在您的修改之后**不会**执行任何重新校验（re-validation）；
- `tool_call` 的返回值仅用于控制阻塞行为，即通过 `{ block: true, reason?: string }` 形式。

```typescript
import { isToolCallEventType } from "@earendil-works/pi-coding-agent";

pi.on("tool_call", async (event, ctx) => {
  // event.toolName - "bash", "read", "write", "edit", etc.
  // event.toolCallId
  // event.input - tool parameters (mutable)

  // Built-in tools: no type params needed
  if (isToolCallEventType("bash", event)) {
    // event.input is { command: string; timeout?: number }
    event.input.command = `source ~/.profile\n${event.input.command}`;

    if (event.input.command.includes("rm -rf")) {
      return { block: true, reason: "Dangerous command" };
    }
  }

  if (isToolCallEventType("read", event)) {
    // event.input is { path: string; offset?: number; limit?: number }
    console.log(`Reading: ${event.input.path}`);
  }
});
```

#### 为自定义工具输入添加类型定义

自定义工具应导出其输入类型：

```typescript
// my-extension.ts
export type MyToolInput = Static<typeof myToolSchema>;
```

使用带显式类型参数的 `isToolCallEventType`：

```typescript
import { isToolCallEventType } from "@earendil-works/pi-coding-agent";
import type { MyToolInput } from "my-extension";

pi.on("tool_call", (event) => {
  if (isToolCallEventType<"my_tool", MyToolInput>("my_tool", event)) {
    event.input.action;  // typed
  }
});
```

#### tool_result

在工具执行完成后、且在 `tool_execution_end` 事件以及最终的工具结果消息事件被发出**之前**触发。**可修改结果。**

在并行工具模式下，`tool_result` 和 `tool_execution_end` 事件将按工具完成的实际顺序交错触发；而最终的 `toolResult` 消息事件仍会按助手原始消息中的顺序（assistant source order）在稍后发出。

`tool_result` 处理器以中间件（middleware）方式链式执行：
- 处理器按扩展加载顺序依次运行；
- 每个处理器看到的是经前一个处理器修改后的最新结果；
- 处理器可返回部分补丁（patch），字段包括 `content`、`details`、`isError` 或 `usage`；未指定的字段将保留其当前值。

在处理器内部执行嵌套异步操作时，请使用 `ctx.signal`。这使得用户按下 Esc 键时，能够取消模型调用、`fetch()` 请求以及其他支持中止（abort-aware）的操作（这些操作由扩展启动）。

```typescript
import { isBashToolResult } from "@earendil-works/pi-coding-agent";

pi.on("tool_result", async (event, ctx) => {
  // event.toolName, event.toolCallId, event.input
  // event.content, event.details, event.isError, event.usage

  if (isBashToolResult(event)) {
    // event.details is typed as BashToolDetails
  }

  const response = await fetch("https://example.com/summarize", {
    method: "POST",
    body: JSON.stringify({ content: event.content }),
    signal: ctx.signal,
  });

  // Modify result:
  return { content: [...], details: {...}, isError: false, usage: nestedModelUsage };
});
```

### 用户 Bash 事件

#### user_bash

当用户执行 `!` 或 `!!` 命令时触发。**可拦截。**

```typescript
import { createLocalBashOperations } from "@earendil-works/pi-coding-agent";

pi.on("user_bash", (event, ctx) => {
  // event.command - the bash command
  // event.excludeFromContext - true if !! prefix
  // event.cwd - working directory

  // Option 1: Provide custom operations (e.g., SSH)
  return { operations: remoteBashOps };

  // Option 2: Wrap pi's built-in local bash backend
  const local = createLocalBashOperations();
  return {
    operations: {
      exec(command, cwd, options) {
        return local.exec(`source ~/.profile\n${command}`, cwd, options);
      }
    }
  };

  // Option 3: Full replacement - return result directly
  return { result: { output: "...", exitCode: 0, cancelled: false, truncated: false } };
});
```

### 输入事件

#### input

在接收到用户输入后触发，此时已检查扩展命令（extension commands），但尚未展开技能（skill）和模板（template）。该事件接收的是原始输入文本，因此 `/skill:foo` 和 `/template` 尚未被展开。

**处理顺序：**
1. 首先检查扩展命令（如 `/cmd`）——若匹配，则运行对应处理器，且跳过 `input` 事件；
2. 触发 `input` 事件——可拦截、转换或处理；
3. 若未被处理：技能命令（如 `/skill:name`）将被展开为对应技能内容；
4. 若未被处理：提示模板命令（如 `/template`）将被展开为对应模板内容；
5. 启动 Agent 处理流程（如 `before_agent_start` 等）。

```typescript
pi.on("input", async (event, ctx) => {
  // event.text - raw input (before skill/template expansion)
  // event.images - attached images, if any
  // event.source - "interactive" (typed), "rpc" (API), or "extension" (via sendUserMessage)
  // event.streamingBehavior - "steer" | "followUp" | undefined
  //   undefined when idle, "steer" for mid-stream interrupts,
  //   "followUp" for messages queued until the agent finishes

  // Transform: rewrite input before expansion
  if (event.text.startsWith("?quick "))
    return { action: "transform", text: `Respond briefly: ${event.text.slice(7)}` };

  // Handle: respond without LLM (extension shows its own feedback)
  if (event.text === "ping") {
    ctx.ui.notify("pong", "info");
    return { action: "handled" };
  }

  // Route by source: skip processing for extension-injected messages
  if (event.source === "extension") return { action: "continue" };

  // Intercept skill commands before expansion
  if (event.text.startsWith("/skill:")) {
    // Could transform, block, or let pass through
  }

  return { action: "continue" };  // Default: pass through to expansion
});
```

**返回结果含义：**
- `continue` —— 原样透传（若处理器未返回任何值，则默认为此行为）；
- `transform` —— 修改文本/图片内容，然后继续进入展开阶段；
- `handled` —— 完全跳过 Agent 处理流程（首个返回此值的处理器胜出）。

转换（transforms）会在各处理器之间链式传递。有关支持 `streamingBehavior` 的路由机制，请参阅示例文件 [input-transform.ts](../examples/extensions/input-transform.ts) 和 [input-transform-streaming.ts](../examples/extensions/input-transform-streaming.ts)。

## ExtensionContext

所有处理器均接收 `ctx: ExtensionContext` 参数。

### ctx.ui

用于用户交互的 UI 方法。完整细节请参见 [自定义 UI](#custom-ui)。

### ctx.mode

当前运行模式：`"tui"`、`"rpc"`、`"json"` 或 `"print"`。可使用 `ctx.mode === "tui"` 来保护仅适用于终端的功能，例如 `custom()`、组件工厂（component factories）、终端输入（terminal input）以及直接 TUI 渲染等。

### ctx.hasUI

在 TUI 和 RPC 模式下为 `true`；在打印模式（`-p`）和 JSON 模式下为 `false`。请使用该属性来保护以下方法：
- 对话类方法（`select`、`confirm`、`input`、`editor`）；
- 即发即弃类方法（`notify`、`setStatus`、`setWidget`、`setTitle`、`setEditorText`）——这些方法在 TUI 和 RPC 模式下均可工作。
在 RPC 模式下，部分 TUI 特有方法将变为无操作（no-op）或返回默认值（详见 [rpc.md](rpc.md#extension-ui-protocol)）。

### ctx.cwd

当前工作目录（Current Working Directory）。

构造项目本地配置路径时，请使用 `CONFIG_DIR_NAME` 而非硬编码 `.pi`。品牌定制版分发包可使用不同的配置目录名称。

```typescript
import { CONFIG_DIR_NAME, type ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { join } from "node:path";

export default function (pi: ExtensionAPI) {
  pi.on("session_start", (_event, ctx) => {
    const projectConfigPath = join(ctx.cwd, CONFIG_DIR_NAME, "my-extension.json");
    // ...
  });
}
```

### ctx.isProjectTrusted()

返回当前会话上下文中项目本地信任（project-local trust）是否处于激活状态。该判断包含临时信任决策及 CLI 层的信任覆盖（trust overrides），而不仅限于全局信任存储（global trust store）中已保存的信任决策。

在读取**仅对受信任项目才应生效**的项目本地扩展配置前，请务必调用此方法进行判断。

### ctx.sessionManager

仅对会话状态具有只读访问权限。完整的 SessionManager API 和条目类型请参见[会话格式](session-format.md)。

对于 `tool_call`，该状态会在处理器运行前通过当前的助手消息进行同步。在并行工具执行模式下，它仍无法保证包含同一助手消息中其他并行工具调用的结果。

```typescript
ctx.sessionManager.getEntries()             // All entries
ctx.sessionManager.getBranch()              // Current branch
ctx.sessionManager.buildContextEntries()    // Active branch entries with compaction applied
ctx.sessionManager.getLeafId()              // Current leaf entry ID
```

### ctx.modelRegistry / ctx.model / ctx.thinkingLevel / ctx.scopedModels

访问模型、提供方及已解析的身份验证信息。`ctx.modelRegistry.getProvider(id)` 返回实际生效的 pi-ai 提供方；而 `getProviderAuth(id)` 则解析其当前的 API 密钥、请求头、基础 URL 以及提供方作用域内的环境变量，且无需加载具体模型即可完成。`ctx.model` 是当前激活的模型，`ctx.thinkingLevel` 是该模型当前实际生效的思维层级。

`ctx.scopedModels` 是一个只读模型列表，其中包含当前会话所限定作用域内的模型——与 `/scoped-models` 命令显示的内容完全一致。该列表在会话启动时根据 `--models` CLI 参数和 `enabledModels` 配置项解析得出（匹配规则基于可用模型目录，采用 minimatch 对 `provider/modelId` 或裸 `modelId` 进行匹配）。若未配置任何作用域限制，则该列表为空，表示所有可用模型均可使用。每个条目形如 `{ model, thinkingLevel? }`，其中 `thinkingLevel` 仅当某匹配模式显式指定了该层级时才存在（例如 `anthropic/*:high`）。建议使用此列表填充模型选择器，使其行为与内置选择器保持一致；而不应通过 `ctx.modelRegistry.getAvailable()` 枚举整个模型目录。

### ctx.signal

当前代理的中止信号（AbortSignal），当无活跃代理轮次（agent turn）时为 `undefined`。

可用于扩展处理器所启动的嵌套任务中，以支持中止感知（abort-aware）操作，例如：
- `fetch(..., { signal: ctx.signal })`
- 支持 `signal` 参数的模型调用
- 支持 `AbortSignal` 参数的文件或进程辅助函数

`ctx.signal` 通常在活跃轮次事件期间被定义，例如 `tool_call`、`tool_result`、`message_update` 和 `turn_end`。
而在空闲或非轮次上下文中（如会话事件、扩展命令、Pi 处于空闲状态时触发的快捷方式），它通常为 `undefined`。

```typescript
pi.on("tool_result", async (event, ctx) => {
  const response = await fetch("https://example.com/api", {
    method: "POST",
    body: JSON.stringify(event),
    signal: ctx.signal,
  });

  const data = await response.json();
  return { details: data };
});
```

### ctx.isIdle() / ctx.abort() / ctx.hasPendingMessages()

流程控制辅助方法。`ctx.isIdle()` 在 Pi 正处理代理运行、自动重试、自动压缩重试或排队中的后续消息时返回 `false`。

### ctx.shutdown()

请求 Pi 执行优雅关机（graceful shutdown）。

- **交互模式（Interactive mode）**：延迟至代理进入空闲状态后执行（即处理完所有排队的引导消息和后续消息之后）。
- **RPC 模式（RPC mode）**：延迟至下一个空闲状态（即完成当前命令响应、等待接收下一条命令时）。
- **打印模式（Print mode）**：无操作（no-op）。当所有提示（prompts）处理完毕后，进程将自动退出。

在退出前，向所有扩展广播 `session_shutdown` 事件。该方法可在所有上下文中调用（包括事件处理器、工具、命令和快捷方式）。

```typescript
pi.on("tool_call", (event, ctx) => {
  if (isFatal(event.input)) {
    ctx.shutdown();
  }
});
```

### ctx.getContextUsage()

返回当前激活模型的上下文用量（context usage）。优先使用最近一次助手消息的用量数据；若不可用，则估算尾部消息的 token 数量。

```typescript
const usage = ctx.getContextUsage();
if (usage && usage.tokens > 100_000) {
  // ...
}
```

### ctx.compact()

触发上下文压缩（compaction），不等待其完成。可使用 `onComplete` 和 `onError` 回调执行后续操作。

```typescript
ctx.compact({
  customInstructions: "Focus on recent changes",
  onComplete: (result) => {
    ctx.ui.notify("Compaction completed", "info");
  },
  onError: (error) => {
    ctx.ui.notify(`Compaction failed: ${error.message}`, "error");
  },
});
```

### ctx.getSystemPrompt()

返回 Pi 当前的系统提示字符串（system prompt string）。

- 在 `before_agent_start` 阶段，该值反映当前轮次中截至目前为止已链式修改过的系统提示内容。
- 它不包含后续 `context` 类型消息的变更。
- 它不包含 `before_provider_request` 阶段对有效载荷（payload）的改写。
- 若在您的扩展之后加载了其他扩展，它们仍可能进一步修改最终发送的系统提示内容。

```typescript
pi.on("before_agent_start", (event, ctx) => {
  const prompt = ctx.getSystemPrompt();
  console.log(`System prompt length: ${prompt.length}`);
});
```

## ExtensionCommandContext（扩展命令上下文）

命令处理器接收 `ExtensionCommandContext`，该类型继承自 `ExtensionContext` 并额外提供了会话控制方法。这些方法仅在命令中可用，因为若在事件处理器中调用可能导致死锁。

### ctx.getSystemPromptOptions()

返回 Pi 当前用于构建系统提示的基础输入项。

```typescript
const options = ctx.getSystemPromptOptions();
const contextPaths = options.contextFiles?.map((file) => file.path) ?? [];
```

该对象结构与 `before_agent_start` 事件中的 `event.systemPromptOptions` 完全相同，且具备同等的可变性：包括自定义提示、激活的工具、工具代码片段、提示指南、追加的系统提示文本、当前工作目录（cwd）、已加载的上下文文件以及已加载的技能。该对象可能包含完整上下文文件的内容，因此应将其视为敏感的扩展本地数据，避免通过命令列表、日志或自动补全元数据等方式对外暴露。此方法报告当前的基础提示输入。它不包括每轮对话中通过 `before_agent_start` 链式调用所修改的系统提示、后续由 `context` 事件消息引发的变更，或 `before_provider_request` 对请求载荷（payload）的重写。

### ctx.waitForIdle()

等待智能体完全进入空闲状态，包括自动重试、自动压缩重试以及排队等待的延续操作：

```typescript
pi.registerCommand("my-cmd", {
  handler: async (args, ctx) => {
    await ctx.waitForIdle();
    // Agent is now idle, safe to modify session
  },
});
```

### ctx.newSession(options?)

创建一个新会话：

```typescript
const parentSession = ctx.sessionManager.getSessionFile();
const kickoff = "Continue in the replacement session";

const result = await ctx.newSession({
  parentSession,
  setup: async (sm) => {
    sm.appendMessage({
      role: "user",
      content: [{ type: "text", text: "Context from previous session..." }],
      timestamp: Date.now(),
    });
  },
  withSession: async (ctx) => {
    // Use only the replacement-session ctx here.
    await ctx.sendUserMessage(kickoff);
  },
});

if (result.cancelled) {
  // An extension cancelled the new session
}
```

选项：
- `parentSession`：在新建会话头信息中记录的父会话文件路径
- `setup`：在 `withSession` 运行前，对新建会话的 `SessionManager` 实例进行修改
- `withSession`：在切换至一个全新的替换会话上下文后，执行后续工作。**请勿使用已捕获的旧 `pi` 或命令 `ctx`**；详见 [会话替换生命周期与常见陷阱](#session-replacement-lifecycle-and-footguns)。

### ctx.fork(entryId, options?)

从指定条目分叉（fork），创建一个新的会话文件：

```typescript
const result = await ctx.fork("entry-id-123", {
  withSession: async (ctx) => {
    // Use only the replacement-session ctx here.
    ctx.ui.notify("Now in the forked session", "info");
  },
});
if (result.cancelled) {
  // An extension cancelled the fork
}

const cloneResult = await ctx.fork("entry-id-456", { position: "at" });
if (cloneResult.cancelled) {
  // An extension cancelled the clone
}
```

选项：
- `position`: `"before"`（默认值）表示在选定的用户消息之前分叉，并将该提示恢复到编辑器中
- `position`: `"at"` 表示复制经过所选条目的当前活跃路径，但不恢复编辑器中的文本
- `withSession`：在切换至一个全新的替换会话上下文后，执行后续工作。**请勿使用已捕获的旧 `pi` 或命令 `ctx`**；详见 [会话替换生命周期与常见陷阱](#session-replacement-lifecycle-and-footguns)。

### ctx.navigateTree(targetId, options?)

导航至会话树中的其他节点：

```typescript
const result = await ctx.navigateTree("entry-id-456", {
  summarize: true,
  customInstructions: "Focus on error handling changes",
  replaceInstructions: false, // true = replace default prompt entirely
  label: "review-checkpoint",
});
```

选项：
- `summarize`：是否为被放弃的分支生成摘要
- `customInstructions`：摘要生成器使用的自定义指令
- `replaceInstructions`：若为 `true`，则 `customInstructions` 将替代默认提示，而非追加到默认提示之后
- `label`：附加到分支摘要条目（或目标条目，若未生成摘要）上的标签

### ctx.switchSession(sessionPath, options?)

切换至另一个会话文件：

```typescript
const result = await ctx.switchSession("/path/to/session.jsonl", {
  withSession: async (ctx) => {
    await ctx.sendUserMessage("Resume work in the replacement session");
  },
});
if (result.cancelled) {
  // An extension cancelled the switch via session_before_switch
}
```

选项：
- `withSession`：在切换至一个全新的替换会话上下文后，执行后续工作。**请勿使用已捕获的旧 `pi` 或命令 `ctx`**；详见 [会话替换生命周期与常见陷阱](#session-replacement-lifecycle-and-footguns)。

要发现可用的会话，请使用静态方法 `SessionManager.list()` 或 `SessionManager.listAll()`：

```typescript
import { SessionManager } from "@earendil-works/pi-coding-agent";

pi.registerCommand("switch", {
  description: "Switch to another session",
  handler: async (args, ctx) => {
    const sessions = await SessionManager.list(ctx.cwd);
    if (sessions.length === 0) return;
    const choice = await ctx.ui.select(
      "Pick session:",
      sessions.map(s => s.file),
    );
    if (choice) {
      await ctx.switchSession(choice, {
        withSession: async (ctx) => {
          ctx.ui.notify("Switched session", "info");
        },
      });
    }
  },
});
```

### 会话替换生命周期与常见陷阱

`withSession` 接收一个全新的 `ReplacedSessionContext` 实例，该类型继承自 `ExtensionCommandContext`，并额外提供了异步的 `sendMessage()` 和 `sendUserMessage()` 辅助方法，这些方法已绑定至替换后的会话。

生命周期与常见陷阱说明：
- `withSession` 仅在旧会话已发出 `session_shutdown` 事件、旧运行时已被彻底销毁、替换会话已完成重新绑定、且新的扩展实例已接收到 `session_start` 事件之后才开始执行。
- 回调函数仍在原始闭包中执行，而非在新的扩展实例内部执行。这意味着您的旧扩展实例可能已在 `withSession` 开始执行前就完成了其关闭清理工作。
- 已捕获的旧 `pi` 或旧命令 `ctx` 中与会话绑定的对象，在会话替换后即变为过期状态，若继续使用将抛出异常。所有与会话相关的操作，请仅使用传递给 `withSession` 的 `ctx`。
- 此前提取出的原始对象仍由您负责管理。例如，若您在替换前执行了 `const sm = ctx.sessionManager`，则 `sm` 仍指向旧的 `SessionManager` 实例。请勿在替换后复用该实例。
- `withSession` 中的代码应假设所有已被您的 `session_shutdown` 处理器标记为无效的状态均已清除。仅可捕获能干净地跨越关闭过程而保留的纯数据，例如字符串、ID 和已序列化的配置。

安全的写法模式：

```typescript
pi.registerCommand("handoff", {
  handler: async (_args, ctx) => {
    const kickoff = "Continue from the replacement session";
    await ctx.newSession({
      withSession: async (ctx) => {
        await ctx.sendUserMessage(kickoff);
      },
    });
  },
});
```

不安全的写法模式：

```typescript
pi.registerCommand("handoff", {
  handler: async (_args, ctx) => {
    const oldSessionManager = ctx.sessionManager;
    await ctx.newSession({
      withSession: async (_ctx) => {
        // stale old objects: do not do this
        oldSessionManager.getSessionFile();
        pi.sendUserMessage("wrong");
      },
    });
  },
});
```

### ctx.reload()

执行与 `/reload` 命令相同的重载流程：

```typescript
pi.registerCommand("reload-runtime", {
  description: "Reload extensions, skills, prompts, themes, and context files",
  handler: async (_args, ctx) => {
    await ctx.reload();
    return;
  },
});
```

重要行为说明：
- `await ctx.reload()` 将为当前扩展运行时触发 `session_shutdown` 事件
- 随后重载资源，并触发 `session_start` 事件（其中 `reason: "reload"`）以及 `resources_discover` 事件（其中 `reason: "reload"`）
- 当前正在运行的命令处理器仍将在旧的调用帧（call frame）中继续执行
- `await ctx.reload()` 后面的代码仍将从重载前的版本中运行
- `await ctx.reload()` 后面的代码不得假定旧的内存中扩展状态仍然有效
- 在该处理器返回后，后续的所有命令、事件及工具调用均将使用新的扩展版本

为确保行为可预测，请将重载视为该处理器的终止操作（即：`await ctx.reload(); return;`）。工具在 `ExtensionContext` 中运行，因此无法直接调用 `ctx.reload()`。应使用命令作为重载入口点，然后暴露一个工具，该工具将该命令作为后续用户消息进行排队。

LLM 可调用以触发重载的示例工具：

```typescript
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

export default function (pi: ExtensionAPI) {
  pi.registerCommand("reload-runtime", {
    description: "Reload extensions, skills, prompts, themes, and context files",
    handler: async (_args, ctx) => {
      await ctx.reload();
      return;
    },
  });

  pi.registerTool({
    name: "reload_runtime",
    label: "Reload Runtime",
    description: "Reload extensions, skills, prompts, themes, and context files",
    parameters: Type.Object({}),
    async execute() {
      pi.sendUserMessage("/reload-runtime", { deliverAs: "followUp" });
      return {
        content: [{ type: "text", text: "Queued /reload-runtime as a follow-up command." }],
      };
    },
  });
}
```

## ExtensionAPI 方法

### pi.on(event, handler)

订阅事件。有关事件类型及返回值，请参阅 [事件](#events)。

### pi.registerTool(definition)

注册一个 LLM 可调用的自定义工具。完整详情请参阅 [自定义工具](#custom-tools)。

`pi.registerTool()` 既可在扩展加载期间调用，也可在启动后调用。您可以在 `session_start`、命令处理器或其他事件处理器中调用它。新注册的工具会在当前会话中立即刷新，因此会立刻出现在 `pi.getAllTools()` 返回结果中，并且无需执行 `/reload` 即可被 LLM 调用。

使用 `pi.setActiveTools()` 可在运行时启用或禁用工具（包括动态添加的工具）。

使用 `promptSnippet` 可使自定义工具在 `可用工具（Available tools）` 列表中以单行形式呈现；使用 `promptGuidelines` 可在该工具处于激活状态时，将工具专属的要点追加至默认的 `指南（Guidelines）` 区域末尾。

**重要提示：** `promptGuidelines` 中的要点将以扁平方式直接追加到 `Guidelines` 区域，**不带工具名称前缀**。每条指南必须明确指出其所指代的工具——避免使用“当……时使用此工具”这类表述，因为 LLM 无法判断“此”具体指代哪个工具；应写作“当……时使用 my_tool”。

完整示例请参阅 [dynamic-tools.ts](../examples/extensions/dynamic-tools.ts)。

```typescript
import { Type } from "typebox";
import { StringEnum } from "@earendil-works/pi-ai";

pi.registerTool({
  name: "my_tool",
  label: "My Tool",
  description: "What this tool does",
  promptSnippet: "Summarize or transform text according to action",
  promptGuidelines: ["Use my_tool when the user asks to summarize previously generated text."],
  parameters: Type.Object({
    action: StringEnum(["list", "add"] as const),
    text: Type.Optional(Type.String()),
  }),
  prepareArguments(args) {
    // Optional compatibility shim. Runs before schema validation.
    // Return the current schema shape, for example to fold legacy fields
    // into the modern parameter object.
    return args;
  },

  async execute(toolCallId, params, signal, onUpdate, ctx) {
    // Stream progress
    onUpdate?.({ content: [{ type: "text", text: "Working..." }] });

    return {
      content: [{ type: "text", text: "Done" }],
      details: { result: "..." },
    };
  },

  // Optional: Custom rendering
  renderCall(args, theme, context) { ... },
  renderResult(result, options, theme, context) { ... },
});
```

### pi.sendMessage(message, options?)

向会话中注入一条自定义消息。自定义消息参与 LLM 上下文。对于仅需持久化显示于终端用户界面（TUI）且**不应发送给 LLM** 的内容，请使用 [`pi.appendEntry()`](#piappendentrycustomtype-data) 配合 [`pi.registerEntryRenderer()`](#piregisterentryrenderercustomtype-renderer)。

```typescript
pi.sendMessage({
  customType: "my-extension",
  content: "Message text",
  display: true,
  details: { ... },
}, {
  triggerTurn: true,
  deliverAs: "steer",
});
```

**选项（Options）：**
- `deliverAs` — 投递模式：
  - `"steer"`（默认）— 在流式传输过程中排队该消息；在当前助手回合完成其所有工具调用后投递，早于下一次 LLM 调用之前。
  - `"followUp"` — 等待智能体（agent）完全结束处理；仅当智能体不再有更多工具调用时才投递。
  - `"nextTurn"` — 排队至下一个用户输入轮次；不会中断或触发任何操作。
- `triggerTurn: true` — 若智能体当前空闲，则立即触发一次 LLM 响应。该选项仅对 `"steer"` 和 `"followUp"` 模式生效（在 `"nextTurn"` 模式下被忽略）。

### pi.sendUserMessage(content, options?)

向智能体发送一条用户消息。与 `sendMessage()` 发送自定义消息不同，此方法发送的是真实用户消息，其外观如同由用户手动键入。该操作总会触发一次新的对话轮次（turn）。

```typescript
// Simple text message
pi.sendUserMessage("What is 2+2?");

// With content array (text + images)
pi.sendUserMessage([
  { type: "text", text: "Describe this image:" },
  { type: "image", source: { type: "base64", mediaType: "image/png", data: "..." } },
]);

// During streaming - must specify delivery mode
pi.sendUserMessage("Focus on error handling", { deliverAs: "steer" });
pi.sendUserMessage("And then summarize", { deliverAs: "followUp" });
```

**选项（Options）：**
- `deliverAs` — 当智能体处于流式传输状态时为**必填项**：
  - `"steer"` — 将消息排队，待当前助手回合完成其所有工具调用后再投递；
  - `"followUp"` — 等待智能体完成全部工具调用。

当智能体未处于流式传输状态时，消息将立即发送并触发新一轮对话。若智能体正在流式传输但未指定 `deliverAs`，则抛出错误。

完整示例请参阅 [send-user-message.ts](../examples/extensions/send-user-message.ts)。

### pi.appendEntry(customType, data?)

持久化保存扩展数据。自定义条目（Custom entries）**不参与 LLM 上下文**。在交互模式下，若配合 `pi.registerEntryRenderer()` 使用，它们亦可在聊天记录中渲染显示。

```typescript
pi.appendEntry("my-state", { count: 42 });
pi.appendEntry("status-card", { title: "Indexed files", count: 17 });

// Restore on reload
pi.on("session_start", async (_event, ctx) => {
  for (const entry of ctx.sessionManager.getEntries()) {
    if (entry.type === "custom" && entry.customType === "my-state") {
      // Reconstruct from entry.data
    }
  }
});
```

### pi.setSessionName(name)

设置会话显示名称（将在会话选择器中显示，替代默认的首条消息内容）。

```typescript
pi.setSessionName("Refactor auth module");
```

### pi.getSessionName()

获取当前已设置的会话名称（若尚未设置则返回 `undefined`）。

```typescript
const name = pi.getSessionName();
if (name) {
  console.log(`Session: ${name}`);
}
```

### pi.setLabel(entryId, label)

为某条记录设置或清除标签（label）。标签是用户自定义的标记，用于书签和导航（在 `/tree` 选择器中显示）。

```typescript
// Set a label
pi.setLabel(entryId, "checkpoint-before-refactor");

// Clear a label
pi.setLabel(entryId, undefined);

// Read labels via sessionManager
const label = ctx.sessionManager.getLabel(entryId);
```

标签会在会话中持久保存，并在重启后依然存在。可用于标记对话树中的关键节点（如特定轮次、检查点等）。

### pi.registerCommand(name, options)

注册一条命令。

若多个扩展注册了同名命令，pi 将全部保留，并按加载顺序分配数字调用后缀，例如 `/review:1` 和 `/review:2`。

```typescript
pi.registerCommand("stats", {
  description: "Show session statistics",
  handler: async (args, ctx) => {
    const count = ctx.sessionManager.getEntries().length;
    ctx.ui.notify(`${count} entries`, "info");
  }
});
```

可选：为 `/command ...` 添加参数自动补全功能：

```typescript
import type { AutocompleteItem } from "@earendil-works/pi-tui";

pi.registerCommand("deploy", {
  description: "Deploy to an environment",
  getArgumentCompletions: (prefix: string): AutocompleteItem[] | null => {
    const envs = ["dev", "staging", "prod"];
    const items = envs.map((e) => ({ value: e, label: e }));
    const filtered = items.filter((i) => i.value.startsWith(prefix));
    return filtered.length > 0 ? filtered : null;
  },
  handler: async (args, ctx) => {
    ctx.ui.notify(`Deploying: ${args}`, "info");
  },
});
```

### pi.getCommands()

获取当前会话中可通过 `prompt` 触发调用的所有斜杠命令（slash commands）。包括扩展命令、提示模板（prompt templates）和技能命令（skill commands）。
该列表顺序与 RPC 方法 `get_commands` 一致：先列出扩展命令，再是模板，最后是技能命令。

```typescript
const commands = pi.getCommands();
const bySource = commands.filter((command) => command.source === "extension");
const userScoped = commands.filter((command) => command.sourceInfo.scope === "user");
```

每个条目具有如下结构：```typescript
{
  name: string; // Invokable command name without the leading slash. May be suffixed like "review:1"
  description?: string;
  source: "extension" | "prompt" | "skill";
  sourceInfo: {
    path: string;
    source: string;
    scope: "user" | "project" | "temporary";
    origin: "package" | "top-level";
    baseDir?: string;
  };
}
```

请使用 `sourceInfo` 作为权威的来源信息字段。切勿通过命令名称或临时路径解析来推断所有权。

内置的交互式命令（例如 `/model` 和 `/settings`）不包含在此处。它们仅在交互模式下处理；若通过 `prompt` 发送，则不会执行。

### pi.registerMessageRenderer(customType, renderer)

为具有您指定 `customType` 的自定义消息注册一个自定义 TUI 渲染器。自定义消息通过 `pi.sendMessage()` 创建，并参与 LLM 上下文。详见 [自定义 UI](#custom-ui)。

### pi.registerMarkdownTransformer(transformer)

为普通用户输入文本、助手回复文本及思考块（thinking blocks）中的 Markdown 注册一个转换器。转换器按扩展加载顺序依次执行，每个转换器接收前一个转换器返回的 Markdown。整条转换链执行完毕后，Pi 将使用其内置渲染器渲染最终转换结果。

转换器接收两个参数：Markdown 字符串，以及一个上下文对象，该对象包含以下字段：

- `messageType` — 值为 `"user"`、`"assistant"` 或 `"assistant-thinking"`
- `isStreaming` — 若为助手流式更新的中间片段则为 `true`；若为用户消息、已完结的助手消息或恢复的历史消息则为 `false`
- `availableWidth` — 可用于渲染转换后 Markdown 内容的确切终端列数

请返回转换后的 Markdown：

```typescript
pi.registerMarkdownTransformer((markdown, { messageType, isStreaming }) => {
  if (isStreaming || messageType === "assistant-thinking") return markdown;
  return markdown.replaceAll("-->", "→");
});
```

若某个转换器抛出异常，Pi 将保留此前所有转换器已生成的 Markdown，并继续执行下一个转换器。该钩子仅影响显示效果：原始消息在会话及模型上下文中保持不变。它会在以下场景中触发：新用户消息、助手流式更新、恢复的会话消息，以及终端宽度发生变化时。因此，转换器应始终保持同步执行且开销低廉。

### pi.registerEntryRenderer(customType, renderer)

为具有您指定 `customType` 的自定义条目注册一个自定义 TUI 渲染器。自定义条目通过 `pi.appendEntry()` 创建，且不参与 LLM 上下文。

```typescript
import { Box, Text } from "@earendil-works/pi-tui";

pi.registerEntryRenderer("status-card", (entry, { expanded }, theme) => {
  const data = entry.data as { title: string; count: number };
  const box = new Box(1, 1, (text) => theme.bg("customMessageBg", text));
  box.addChild(new Text(`${theme.bold(data.title)}: ${data.count}`));
  if (expanded) {
    box.addChild(new Text(theme.fg("dim", JSON.stringify(data, null, 2))));
  }
  return box;
});

pi.appendEntry("status-card", { title: "Indexed files", count: 17 });
```

### pi.registerShortcut(shortcut, options)

注册一个键盘快捷键。快捷键格式及内置快捷键详见 [keybindings.md](keybindings.md)。

```typescript
pi.registerShortcut("ctrl+shift+p", {
  description: "Toggle plan mode",
  handler: async (ctx) => {
    ctx.ui.notify("Toggled!");
  },
});
```

### pi.registerFlag(name, options)

注册一个 CLI 标志（flag）。

```typescript
pi.registerFlag("plan", {
  description: "Start in plan mode",
  type: "boolean",
  default: false,
});

// Check value
if (pi.getFlag("plan")) {
  // Plan mode enabled
}
```

### pi.exec(command, args, options?)

执行一个 Shell 命令。

```typescript
const result = await pi.exec("git", ["status"], { signal, timeout: 5000 });
// result.stdout, result.stderr, result.code, result.killed
```

### pi.getActiveTools() / pi.getAllTools() / pi.setActiveTools(names)

管理当前启用的工具。该接口同时适用于内置工具与动态注册的工具。`pi.getActiveTools()` 返回当前启用的工具名称数组（`string[]`）；`pi.getAllTools()` 返回所有已配置工具的元数据。

```typescript
const active = pi.getActiveTools(); // ["read", "bash", ...]
const all = pi.getAllTools();
// all = [{
//   name: "read",
//   description: "Read file contents...",
//   parameters: ...,
//   promptGuidelines: ["Use read to examine files instead of cat or sed."],
//   sourceInfo: { path: "<builtin:read>", source: "builtin", scope: "temporary", origin: "top-level" }
// }, ...]
const builtinTools = all.filter((t) => t.sourceInfo.source === "builtin");
const extensionTools = all.filter((t) => t.sourceInfo.source !== "builtin" && t.sourceInfo.source !== "sdk");
pi.setActiveTools([...new Set([...active, "my_custom_tool"])]); // Keep current tools and enable my_custom_tool
pi.setActiveTools(["read", "bash"]); // Switch to read-only
```

`pi.getAllTools()` 返回字段包括：`name`、`description`、`parameters`、`promptGuidelines` 和 `sourceInfo`。

典型的 `sourceInfo.source` 取值如下：
- `builtin`：表示内置工具；
- `sdk`：表示通过 `createAgentSession({ customTools })` 传入的工具；
- 扩展源元数据：表示由扩展注册的工具。

### pi.setModel(model)

设置当前模型。若该模型无可用 API 密钥，则返回 `false`。有关自定义模型的配置方法，请参阅 [models.md](models.md)。

```typescript
const model = ctx.modelRegistry.find("anthropic", "claude-sonnet-4-5");
if (model) {
  const success = await pi.setModel(model);
  if (!success) {
    ctx.ui.notify("No API key for this model", "error");
  }
}
```

### pi.getThinkingLevel() / pi.setThinkingLevel(level)

获取或设置思考级别（thinking level）。该级别将被限制在模型能力范围内（非推理型模型始终使用 `"off"`）。该设置变更将触发 `thinking_level_select` 事件。

```typescript
const current = pi.getThinkingLevel();  // "off" | "minimal" | "low" | "medium" | "high" | "xhigh" | "max"
pi.setThinkingLevel("high");
```

### pi.events

扩展间通信所共用的事件总线：

```typescript
pi.events.on("my:event", (data) => { ... });
pi.events.emit("my:event", { ... });
```

### pi.registerProvider(name, config)

动态注册或覆盖一个模型提供商（model provider）。此功能适用于代理服务、自定义端点或团队级模型配置。

在扩展工厂函数（extension factory function）执行期间调用的 `registerProvider` 将被排队，并于运行器（runner）初始化完成后统一应用；而在此之后调用的（例如，在用户完成设置流程后、由命令处理器触发的调用），则立即生效，无需执行 `/reload`。

动态注册的提供商可实现 `refreshModels` 方法。Pi 在刷新模型列表时会调用该方法，并将返回的模型列表以同步方式发布至该提供商，同时传递标准的凭证/已存储目录/网络/信号上下文（canonical credential/stored-catalog/network/signal context）。扩展需自行决定是否通过带生成校验的 `context.publish({ persist: entry })` 持久化目录元数据；对于 llama.cpp 等实时服务器，可直接返回模型列表而不做持久化。`context.signal` 始终是一个具体的信号，提供程序的回调函数必须将该信号传递给阻塞式 I/O 操作。公共方法 `ModelRuntime.refresh()` 和 `ModelRegistry.refresh()` 接受一个可选的信号参数；当该参数被省略时，调用将无超时限制；扩展程序和应用程序应自行设定各自的截止时间。即使某个提供程序忽略该信号，取消操作仍会终止调用方的等待；但要真正中止底层工作，仍需提供程序主动配合。

需要原生提供程序认证（auth）、过滤（filtering）、刷新（refresh）或流式（stream）行为的扩展程序，可从 `@earendil-works/pi-ai` 包注册一个完整的 `Provider`。该提供程序将成为组合基础，而 `models.json` 中的覆盖配置仍将在此基础之上生效。

```typescript
import { createProvider, openAICompletionsApi } from "@earendil-works/pi-ai";

const provider = createProvider({
  id: "local-server",
  name: "Local Server",
  baseUrl: "http://localhost:8080/v1",
  auth: {
    apiKey: {
      name: "Local server setup",
      async login(interaction) {
        return {
          type: "api_key",
          key: await interaction.prompt({ type: "secret", message: "API key" }),
        };
      },
      async resolve({ credential }) {
        return credential?.key
          ? { auth: { apiKey: credential.key }, source: "stored API key" }
          : undefined;
      },
    },
  },
  models: [],
  api: openAICompletionsApi(),
});

pi.registerProvider(provider);

// Register a new provider with custom models
pi.registerProvider("my-proxy", {
  name: "My Proxy",
  baseUrl: "https://proxy.example.com",
  apiKey: "$PROXY_API_KEY",  // env var reference
  api: "anthropic-messages",
  models: [
    {
      id: "claude-sonnet-4-20250514",
      name: "Claude 4 Sonnet (proxy)",
      reasoning: false,
      input: ["text", "image"],
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
      contextWindow: 200000,
      maxTokens: 16384
    }
  ]
});

// Register a live llama.cpp catalog without persisting discovered models
pi.registerProvider("llama.cpp", {
  baseUrl: "http://localhost:8080/v1",
  apiKey: "local",
  api: "openai-completions",
  async refreshModels({ signal }) {
    const response = await fetch("http://localhost:8080/v1/models", { signal });
    const { data } = await response.json();
    return data.map(({ id }) => ({
      id,
      name: id,
      reasoning: false,
      input: ["text"],
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
      contextWindow: 128000,
      maxTokens: 16384
    }));
  }
});

// Override baseUrl for an existing provider (keeps all models)
pi.registerProvider("anthropic", {
  baseUrl: "https://proxy.example.com"
});

// Register provider with OAuth support for /login
pi.registerProvider("corporate-ai", {
  baseUrl: "https://ai.corp.com",
  api: "openai-responses",
  models: [...],
  oauth: {
    name: "Corporate AI (SSO)",
    async login(callbacks) {
      // Custom OAuth flow
      callbacks.onAuth({ url: "https://sso.corp.com/..." });
      const code = await callbacks.onPrompt({ message: "Enter code:" });
      return { refresh: code, access: code, expires: Date.now() + 3600000 };
    },
    async refreshToken(credentials, signal) {
      signal.throwIfAborted();
      // Refresh logic
      return credentials;
    },
    getApiKey(credentials) {
      return credentials.access;
    }
  }
});
```

对象形式接受一个完整的 pi-ai `Provider`，包括原生的 `auth`、`getModels`、`refreshModels`、`filterModels`、`stream` 和 `streamSimple` 行为。

**传统配置选项：**  
- `name` — 提供程序在 UI（例如 `/login` 页面）中显示的名称。  
- `baseUrl` — API 端点 URL。定义模型时必需。  
- `apiKey` — API 密钥字面量、环境变量插值（`$ENV_VAR` 或 `${ENV_VAR}`），或以 `!command` 开头的命令执行语法。定义模型时必需（除非同时提供了 `oauth` 配置）。`$$` 用于转义 `$` 字符，`$!` 用于转义字面量 `!` 而不触发命令执行。  
- `api` — API 类型：如 `"anthropic-messages"`、`"openai-completions"`、`"openai-responses"` 等。  
- `headers` — 请求中需包含的自定义请求头。  
- `authHeader` — 若为 `true`，则自动添加 `Authorization: Bearer` 请求头。  
- `models` — 模型定义数组。若提供此字段，则完全替换该提供程序当前所有已有模型。模型定义中可设置 `baseUrl`，以覆盖该模型所使用的提供程序端点。  
- `refreshModels` — 异步动态发现回调函数。其返回的模型将替换扩展程序提供的模型。`context.stored` 包含已持久化的提供程序快照；仅当更新后的目录数据需要持久化时，才应使用带生成号校验的 `context.publish({ persist: entry })`。使用 `persist: null` 可删除该快照。  
- `oauth` — OAuth 提供程序配置，用于支持 `/login` 功能。一旦提供，该提供程序即会出现在登录菜单中。  
- `streamSimple` — 针对非标准 API 的自定义流式实现。

高级主题（如自定义流式 API、OAuth 详细说明、模型定义参考）请参阅 [custom-provider.md](custom-provider.md)。

### pi.unregisterProvider(name)

移除先前已注册的提供程序及其全部模型。该提供程序曾覆盖的内置模型将被恢复。若该提供程序此前未被注册，则此操作无任何效果。

与 `registerProvider` 类似，该方法在初始加载阶段完成后立即生效，因此无需执行 `/reload` 命令。

```typescript
pi.registerCommand("my-setup-teardown", {
  description: "Remove the custom proxy provider",
  handler: async (_args, _ctx) => {
    pi.unregisterProvider("my-proxy");
  },
});
```

## 状态管理

带有状态的扩展程序应将状态存储于工具结果的 `details` 字段中，以获得正确的分支支持：

```typescript
export default function (pi: ExtensionAPI) {
  let items: string[] = [];

  // Reconstruct state from session
  pi.on("session_start", async (_event, ctx) => {
    items = [];
    for (const entry of ctx.sessionManager.getBranch()) {
      if (entry.type === "message" && entry.message.role === "toolResult") {
        if (entry.message.toolName === "my_tool") {
          items = entry.message.details?.items ?? [];
        }
      }
    }
  });

  pi.registerTool({
    name: "my_tool",
    // ...
    async execute(toolCallId, params, signal, onUpdate, ctx) {
      items.push("new item");
      return {
        content: [{ type: "text", text: "Added" }],
        details: { items: [...items] },  // Store for reconstruction
      };
    },
  });
}
```

## 自定义工具

通过 `pi.registerTool()` 注册 LLM 可调用的工具。这些工具将出现在系统提示词中，并支持自定义渲染。

使用 `promptSnippet` 可在默认系统提示词的 `Available tools`（可用工具）部分中插入一行简短描述。若省略该字段，则自定义工具不会出现在该部分中。

使用 `promptGuidelines` 可向默认系统提示词的 `Guidelines`（指南）部分添加特定于该工具的要点条目。这些要点仅在工具处于激活状态时（例如，在调用 `pi.setActiveTools([...])` 后）才会被包含。

**重要提示：** `promptGuidelines` 中的要点将以扁平方式直接追加至 `Guidelines` 部分，不带工具名称前缀，也不进行分组。每条指南都必须明确指出其所对应的工具名称——避免使用“当……时请使用此工具”这类表述，因为大语言模型无法判断“此工具”具体指哪一个。应明确写作“当……时请使用 my_tool”。

注意：某些模型存在缺陷，会在工具路径参数中错误地包含 `@` 前缀。内置工具在解析路径前会自动剥离开头的 `@`。如果你的自定义工具接受路径参数，也应同样规范化处理开头的 `@`。

如果你的自定义工具会修改文件，请使用 `withFileMutationQueue()`，使其参与与内置 `edit` 和 `write` 工具相同的按文件队列机制。这一点至关重要，因为工具调用默认是并行执行的。若不加入该队列，两个工具可能同时读取同一份旧文件内容，各自计算出不同的更新，最终后写入的结果将覆盖先写入的更改。

典型失败场景示例：你的自定义工具正在编辑 `foo.ts`，而内置 `edit` 工具在同一轮助手响应中也修改了 `foo.ts`。如果你的工具未加入该队列，两者均可能读取原始的 `foo.ts` 内容，分别应用不同变更，最终其中一个变更将被覆盖丢失。将真实的目标文件路径传递给 `withFileMutationQueue()`，而非原始的用户参数。首先将其解析为相对于 `ctx.cwd` 或您工具工作目录的绝对路径。对于已存在的文件，该辅助函数会通过 `realpath()` 进行规范化处理，因此指向同一文件的符号链接别名将共享同一个队列。对于新文件，由于尚无实际文件可供 `realpath()` 解析，因此回退至已解析的绝对路径。

在该目标路径上排队整个变更窗口（mutation window），这包括读-改-写（read-modify-write）逻辑，而不仅仅是最终的写入操作。

```typescript
import { withFileMutationQueue } from "@earendil-works/pi-coding-agent";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
  const absolutePath = resolve(ctx.cwd, params.path);

  return withFileMutationQueue(absolutePath, async () => {
    await mkdir(dirname(absolutePath), { recursive: true });
    const current = await readFile(absolutePath, "utf8");
    const next = current.replace(params.oldText, params.newText);
    await writeFile(absolutePath, next, "utf8");

    return {
      content: [{ type: "text", text: `Updated ${params.path}` }],
      details: {},
    };
  });
}
```

### 工具定义

```typescript
import { Type } from "typebox";
import { StringEnum } from "@earendil-works/pi-ai";
import { Text } from "@earendil-works/pi-tui";

pi.registerTool({
  name: "my_tool",
  label: "My Tool",
  description: "What this tool does (shown to LLM)",
  promptSnippet: "List or add items in the project todo list",
  promptGuidelines: [
    "Use my_tool for todo planning instead of direct file edits when the user asks for a task list."
  ],
  parameters: Type.Object({
    action: StringEnum(["list", "add"] as const),  // Use StringEnum for Google compatibility
    text: Type.Optional(Type.String()),
  }),
  prepareArguments(args) {
    if (!args || typeof args !== "object") return args;
    const input = args as { action?: string; oldAction?: string };
    if (typeof input.oldAction === "string" && input.action === undefined) {
      return { ...input, action: input.oldAction };
    }
    return args;
  },

  async execute(toolCallId, params, signal, onUpdate, ctx) {
    // Check for cancellation
    if (signal?.aborted) {
      return { content: [{ type: "text", text: "Cancelled" }] };
    }

    // Stream progress updates
    onUpdate?.({
      content: [{ type: "text", text: "Working..." }],
      details: { progress: 50 },
    });

    // Run commands via pi.exec (captured from extension closure)
    const result = await pi.exec("some-command", [], { signal });

    // Return result
    return {
      content: [{ type: "text", text: "Done" }],  // Sent to LLM
      details: { data: result },                   // For rendering & state
      // usage: nestedModelResponse.usage,          // Optional nested LLM usage
      // Optional: stop after this tool batch when every finalized tool result
      // in the batch also returns terminate: true.
      terminate: true,
    };
  },

  // Optional: Custom rendering
  renderCall(args, theme, context) { ... },
  renderResult(result, options, theme, context) { ... },
});
```

**用量统计（Usage accounting）：** 若某工具执行了嵌套的 LLM 调用，请将它们的合并 `Usage` 作为 `usage` 返回。Pi 会将其持久化存储于工具结果中，并将其纳入页脚、`/session` 接口以及 RPC 会话总量统计中。`tool_result` 处理器可检查或替换该值。

**错误信号（Signaling errors）：** 若需将工具执行标记为失败（即在结果中设置 `isError: true` 并向 LLM 报告该错误），请从 `execute` 方法中抛出异常。无论返回对象中包含何种属性，仅靠返回值永远不会触发错误标志。

**提前终止（Early termination）：** 从 `execute()` 中返回 `terminate: true`，可提示在当前工具批次执行完毕后跳过自动发起的后续 LLM 调用。该行为仅在该批次中所有已确定（finalized）的工具结果均处于终止状态时生效。参见 [examples/extensions/structured-output.ts](../examples/extensions/structured-output.ts)，其中提供了一个最小示例：智能体在一次最终的结构化输出（structured-output）工具调用后结束运行。

```typescript
// Correct: throw to signal an error
async execute(toolCallId, params) {
  if (!isValid(params.input)) {
    throw new Error(`Invalid input: ${params.input}`);
  }
  return { content: [{ type: "text", text: "OK" }], details: {} };
}
```

**重要提示：** 请使用 `@earendil-works/pi-ai` 包中的 `StringEnum` 类型定义字符串枚举。`Type.Union` / `Type.Literal` 在 Google 的 API 中无法正常工作。

**参数预处理（Argument preparation）：** `prepareArguments(args)` 是可选方法。若已定义，它将在模式校验（schema validation）及 `execute()` 执行之前被调用。当 Pi 恢复一个旧会话，而该会话中存储的工具调用参数已不再匹配当前 schema 时，可利用此方法模拟旧版所接受的输入格式。请返回您希望依据 `parameters` 进行校验的对象。请保持公开 schema 的严格性；切勿仅为兼容旧会话的恢复而向 `parameters` 中添加已弃用的兼容性字段。

示例：一个旧会话可能包含一个 `edit` 工具调用，其参数为顶层字段 `oldText` 和 `newText`；而当前 schema 仅接受 `edits: [{ oldText, newText }]` 形式的参数。

```typescript
pi.registerTool({
  name: "edit",
  label: "Edit",
  description: "Edit a single file using exact text replacement",
  parameters: Type.Object({
    path: Type.String(),
    edits: Type.Array(
      Type.Object({
        oldText: Type.String(),
        newText: Type.String(),
      }),
    ),
  }),
  prepareArguments(args) {
    if (!args || typeof args !== "object") return args;

    const input = args as {
      path?: string;
      edits?: Array<{ oldText: string; newText: string }>;
      oldText?: unknown;
      newText?: unknown;
    };

    if (typeof input.oldText !== "string" || typeof input.newText !== "string") {
      return args;
    }

    return {
      ...input,
      edits: [...(input.edits ?? []), { oldText: input.oldText, newText: input.newText }],
    };
  },
  async execute(toolCallId, params, signal, onUpdate, ctx) {
    // params now matches the current schema
    return {
      content: [{ type: "text", text: `Applying ${params.edits.length} edit block(s)` }],
      details: {},
    };
  },
});
```

### 覆盖内置工具

扩展可通过注册同名工具来覆盖内置工具（如 `read`、`bash`、`edit`、`write`、`grep`、`find`、`ls`）。交互模式下，发生此类覆盖时将显示警告。

```bash
# Extension's read tool replaces built-in read
pi -e ./tool-override.ts
```

或者，可使用 `--no-builtin-tools` 启动选项，在禁用全部内置工具的同时保留扩展工具的启用状态：
```bash
# No built-in tools, only extension tools
pi --no-builtin-tools -e ./my-extension.ts
```

完整示例请参见 [examples/extensions/tool-override.ts](../examples/extensions/tool-override.ts)，其中演示了如何以日志记录与访问控制功能覆盖 `read` 工具。

**渲染（Rendering）：** 内置渲染器的继承机制按插槽（slot）独立解析。执行逻辑覆盖与渲染逻辑覆盖彼此独立。若您的覆盖实现未定义 `renderCall`，则自动采用内置的 `renderCall`；若未定义 `renderResult`，则自动采用内置的 `renderResult`；若两者均未定义，则自动启用内置渲染器（含语法高亮、差异对比等功能）。这使得您可在不重写 UI 的前提下，通过包装内置工具实现日志记录或访问控制。

**提示词元数据（Prompt metadata）：** `promptSnippet` 和 `promptGuidelines` 不会从内置工具继承。若您的覆盖实现需保留这些提示指令，请显式地在覆盖定义中声明它们。

**您的实现必须严格匹配原始结果形状（exact result shape）**，包括 `details` 字段的具体类型。UI 渲染与会话状态逻辑均依赖这些形状进行渲染和状态追踪。内置工具实现：
- [read.ts](https://github.com/earendil-works/pi-mono/blob/main/packages/coding-agent/src/core/tools/read.ts) — `ReadToolDetails`
- [bash.ts](https://github.com/earendil-works/pi-mono/blob/main/packages/coding-agent/src/core/tools/bash.ts) — `BashToolDetails`
- [edit.ts](https://github.com/earendil-works/pi-mono/blob/main/packages/coding-agent/src/core/tools/edit.ts)
- [write.ts](https://github.com/earendil-works/pi-mono/blob/main/packages/coding-agent/src/core/tools/write.ts)
- [grep.ts](https://github.com/earendil-works/pi-mono/blob/main/packages/coding-agent/src/core/tools/grep.ts) — `GrepToolDetails`
- [find.ts](https://github.com/earendil-works/pi-mono/blob/main/packages/coding-agent/src/core/tools/find.ts) — `FindToolDetails`
- [ls.ts](https://github.com/earendil-works/pi-mono/blob/main/packages/coding-agent/src/core/tools/ls.ts) — `LsToolDetails`

### 远程执行

内置工具支持可插拔的操作机制，以将任务委派至远程系统（如 SSH、容器等）：

```typescript
import { createReadTool, createBashTool, type ReadOperations } from "@earendil-works/pi-coding-agent";

// Create tool with custom operations
const remoteRead = createReadTool(cwd, {
  operations: {
    readFile: (path) => sshExec(remote, `cat ${path}`),
    access: (path) => sshExec(remote, `test -r ${path}`).then(() => {}),
  }
});

// Register, checking flag at execution time
pi.registerTool({
  ...remoteRead,
  async execute(id, params, signal, onUpdate, _ctx) {
    const ssh = getSshConfig();
    if (ssh) {
      const tool = createReadTool(cwd, { operations: createRemoteOps(ssh) });
      return tool.execute(id, params, signal, onUpdate);
    }
    return localRead.execute(id, params, signal, onUpdate);
  },
});
```

**操作接口：** `ReadOperations`、`WriteOperations`、`EditOperations`、`BashOperations`、`LsOperations`、`GrepOperations`、`FindOperations`

对于 `user_bash`，扩展可通过 `createLocalBashOperations()` 复用 pi 的本地 shell 后端，而无需重新实现本地进程启动、shell 解析及进程树终止逻辑。

Bash 工具还支持一个 spawn hook，可在执行前调整命令、当前工作目录（cwd）或环境变量（env）：

```typescript
import { createBashTool } from "@earendil-works/pi-coding-agent";

const bashTool = createBashTool(cwd, {
  spawnHook: ({ command, cwd, env }) => ({
    command: `source ~/.profile\n${command}`,
    cwd: `/mnt/sandbox${cwd}`,
    env: { ...env, CI: "1" },
  }),
});
```

`createBashTool()` 通过 `PI_SESSION_ID`、`PI_SESSION_FILE`、`PI_PROVIDER`、`PI_MODEL` 和 `PI_REASONING_LEVEL` 将当前会话信息注入到命令中。该注入发生在 `spawnHook` 执行之前，因此 hook 可在 `env` 参数中接收到这些值，并在如上例所示地展开现有环境时保留它们。设置 `exposeSessionEnvironment: false` 可禁用此行为：

```typescript
const bashTool = createBashTool(cwd, {
  exposeSessionEnvironment: false,
});
```

有关各环境变量语义，请参阅 [Bash 工具会话环境](environment-variables.md#bash-tool-session-environment)。完整 SSH 示例（含 `--ssh` 标志）见 [examples/extensions/ssh.ts](../examples/extensions/ssh.ts)。

### 输出截断

**工具必须对其输出进行截断**，以避免压垮大语言模型（LLM）的上下文。过大的输出可能导致：
- 上下文溢出错误（提示过长）
- 压缩失败
- 模型性能下降

内置限制为 **50 KB**（约 10,000 个 token）或 **2000 行**，以先达到者为准。请使用导出的截断工具函数：

```typescript
import {
  truncateHead,      // Keep first N lines/bytes (good for file reads, search results)
  truncateTail,      // Keep last N lines/bytes (good for logs, command output)
  truncateLine,      // Truncate a single line to maxBytes with ellipsis
  formatSize,        // Human-readable size (e.g., "50KB", "1.5MB")
  DEFAULT_MAX_BYTES, // 50KB
  DEFAULT_MAX_LINES, // 2000
} from "@earendil-works/pi-coding-agent";

async execute(toolCallId, params, signal, onUpdate, ctx) {
  const output = await runCommand();

  // Apply truncation
  const truncation = truncateHead(output, {
    maxLines: DEFAULT_MAX_LINES,
    maxBytes: DEFAULT_MAX_BYTES,
  });

  let result = truncation.content;

  if (truncation.truncated) {
    // Write full output to temp file
    const tempFile = writeTempFile(output);

    // Inform the LLM where to find complete output
    result += `\n\n[Output truncated: ${truncation.outputLines} of ${truncation.totalLines} lines`;
    result += ` (${formatSize(truncation.outputBytes)} of ${formatSize(truncation.totalBytes)}).`;
    result += ` Full output saved to: ${tempFile}]`;
  }

  return { content: [{ type: "text", text: result }] };
}
```

**关键要点：**
- 对于开头更重要的内容（如搜索结果、文件读取），使用 `truncateHead`
- 对于结尾更重要的内容（如日志、命令输出），使用 `truncateTail`
- 当输出被截断时，务必告知 LLM，并说明完整版本的获取位置
- 在工具描述中明确记录截断限制

完整示例（对 `rg`（ripgrep）进行正确截断封装）见 [examples/extensions/truncated-tool.ts](../examples/extensions/truncated-tool.ts)。

### 多工具支持

一个扩展可注册多个工具，并共享状态：

```typescript
export default function (pi: ExtensionAPI) {
  let connection = null;

  pi.registerTool({ name: "db_connect", ... });
  pi.registerTool({ name: "db_query", ... });
  pi.registerTool({ name: "db_close", ... });

  pi.on("session_shutdown", async () => {
    connection?.close();
  });
}
```

### 自定义渲染

工具可通过提供 `renderCall` 和 `renderResult` 实现自定义 TUI 显示。完整组件 API 见 [tui.md](tui.md)，工具行的组合方式见 [tool-execution.ts](https://github.com/earendil-works/pi-mono/blob/main/packages/coding-agent/src/modes/interactive/components/tool-execution.ts)。

默认情况下，工具输出会被包裹在一个 `Box` 组件中，该组件负责处理内边距与背景色。若定义了 `renderCall` 或 `renderResult`，则其返回值必须为一个 `Component`。若某插槽（slot）的渲染器未定义，则 `tool-execution.ts` 将对该插槽使用回退渲染逻辑。

当工具需自行渲染其 shell（而非使用默认 `Box`）时，请设置 `renderShell: "self"`。此选项适用于需要完全控制边框或背景行为的工具，例如大型预览界面——此类界面必须在工具执行完成后保持视觉稳定性。

```typescript
pi.registerTool({
  name: "my_tool",
  label: "My Tool",
  description: "Custom shell example",
  parameters: Type.Object({}),
  renderShell: "self",
  async execute() {
    return { content: [{ type: "text", text: "ok" }], details: undefined };
  },
  renderCall(args, theme, context) {
    return new Text(theme.fg("accent", "my custom shell"), 0, 0);
  },
});
```

`renderCall` 和 `renderResult` 各自接收一个 `context` 对象，其字段包括：
- `args` — 当前工具调用的参数
- `state` — 跨 `renderCall` 与 `renderResult` 共享的、行级局部状态
- `lastComponent` — 该插槽此前返回的组件（若存在）
- `invalidate()` — 请求重绘该工具所在行
- `toolCallId`、`cwd`、`executionStarted`、`argsComplete`、`isPartial`、`expanded`、`showImages`、`isError`使用 `context.state` 实现跨插槽的共享状态。当您希望在多次渲染中复用并修改同一组件时，请将插槽本地缓存保留在返回的组件实例上。

#### renderCall

渲染工具调用或标题：

```typescript
import { Text } from "@earendil-works/pi-tui";

renderCall(args, theme, context) {
  const text = (context.lastComponent as Text | undefined) ?? new Text("", 0, 0);
  let content = theme.fg("toolTitle", theme.bold("my_tool "));
  content += theme.fg("muted", args.action);
  if (args.text) {
    content += " " + theme.fg("dim", `"${args.text}"`);
  }
  text.setText(content);
  return text;
}
```

#### renderResult

渲染工具结果或输出：

```typescript
renderResult(result, { expanded, isPartial }, theme, context) {
  if (isPartial) {
    return new Text(theme.fg("warning", "Processing..."), 0, 0);
  }

  if (result.details?.error) {
    return new Text(theme.fg("error", `Error: ${result.details.error}`), 0, 0);
  }

  let text = theme.fg("success", "✓ Done");
  if (expanded && result.details?.items) {
    for (const item of result.details.items) {
      text += "\n  " + theme.fg("dim", item);
    }
  }
  return new Text(text, 0, 0);
}
```

如果某个插槽有意不显示任何内容，请返回一个空的 `Component`（例如空的 `Container`）。

#### 键绑定提示（Keybinding Hints）

使用 `keyHint()` 显示键绑定提示，该提示会尊重当前激活的键绑定配置：

```typescript
import { keyHint } from "@earendil-works/pi-coding-agent";

renderResult(result, { expanded }, theme, context) {
  let text = theme.fg("success", "✓ Done");
  if (!expanded) {
    text += ` (${keyHint("app.tools.expand", "to expand")})`;
  }
  return new Text(text, 0, 0);
}
```

可用函数：
- `keyHint(keybinding, description)` —— 格式化已配置的键绑定 ID，例如 `"app.tools.expand"` 或 `"tui.select.confirm"`
- `keyText(keybinding)` —— 返回指定键绑定 ID 对应的原始已配置按键文本
- `rawKeyHint(key, description)` —— 格式化原始按键字符串

请使用带命名空间的键绑定 ID：
- 编码代理（coding-agent）ID 使用 `app.*` 命名空间，例如 `app.tools.expand`、`app.editor.external`、`app.session.rename`
- 共享 TUI ID 使用 `tui.*` 命名空间，例如 `tui.select.confirm`、`tui.select.cancel`、`tui.input.tab`

完整键绑定 ID 列表及其默认值，请参阅 [keybindings.md](keybindings.md)。`keybindings.json` 文件中也使用这些相同命名空间的 ID。

自定义编辑器及通过 `ctx.ui.custom()` 创建的组件会以注入参数形式接收 `keybindings: KeybindingsManager`。它们应直接使用该注入的管理器，**而非**调用 `getKeybindings()` 或 `setKeybindings()`。

#### 最佳实践（Best Practices）

- 使用 `Text` 时，padding 设置为 `(0, 0)`；默认 `Box` 已负责处理内边距。
- 使用 `\n` 表示多行内容。
- 为流式传输进度处理 `isPartial`。
- 支持 `expanded` 属性，实现按需展开详细信息。
- 默认视图应保持紧凑。
- 在 `renderResult` 中读取 `context.args`，**不要**将参数复制到 `context.state` 中。
- **仅**在数据必须在调用插槽与结果插槽之间共享时，才使用 `context.state`。
- 当同一组件实例可就地更新时，复用 `context.lastComponent`。
- **仅当**默认带框外壳（boxed shell）造成干扰时，才使用 `renderShell: "self"`；在此模式下，工具需自行负责其外框、内边距和背景。

#### 回退机制（Fallback）

若某插槽渲染器未定义或抛出异常：
- `renderCall`：显示工具名称；
- `renderResult`：显示 `content` 中的原始文本。

### 动态工具加载（Dynamic Tool Loading）

扩展可注册大量工具，同时仅保持少量初始工具处于激活状态。工具可在执行过程中通过 `pi.setActiveTools()` 动态添加更多工具。Pi 会检测纯新增变更，将新可用的工具名称记录在该工具的结果中，并在下一次模型请求前应用更新后的激活工具集。

该机制适用于所有模型。具备原生延迟加载支持的模型将保留稳定的提示前缀，并在工具结果位置加载新定义；其他模型则采用下方所述的回退机制。

其生命周期如下：

1. 使用 `pi.registerTool()` 注册全部工具，使其出现在 `pi.getAllTools()` 中；
2. 将加载器类工具（如 `search_tools`）保持为激活状态，而将可搜索类工具设为非激活状态；
3. 在加载器执行期间，调用 `pi.setActiveTools([...currentTools, ...matchingTools])`。该变更必须是纯新增的：**不得**在同一调用中移除当前已激活的工具；
4. Pi 将记录哪些工具被添加至该加载器的工具结果中；
5. 在下一次模型响应之前，Pi 将根据是否支持原生延迟加载，分别采用原生方式暴露新增定义，或使用常规的激活工具列表。

您无需返回特定于提供方的工具引用，也无需将加载器标记为特殊的搜索工具。“激活工具集变更”本身即为信号。传入 `pi.setActiveTools()` 的名称必须已预先注册；未知名称将被忽略。

#### 支持原生延迟加载的模型

- **Anthropic**
  - **模型：** Sonnet、Opus、Fable 4.5 或更高版本（不含 Haiku）
  - **原生表示：** 延迟定义使用 `defer_loading`；加载点使用 `tool_reference` 类型的内容。
- **OpenAI**
  - **模型：** `gpt-5.4` 及更新系列
  - **原生表示：** Pi 在加载点处添加已完成的客户端 `tool_search_call` 和 `tool_search_output` 条目。

对于经验证的自定义模型或代理，可通过以下方式启用原生处理：
- 对 `anthropic-messages`，设置 `compat.supportsToolReferences: true`；
- 对 `openai-responses` 和 `openai-codex-responses`，设置 `compat.supportsToolSearch: true`。  
除非对应端点与模型明确支持相应的原生协议，否则请保持这些选项禁用。

#### 回退行为（Fallback behavior）

对于所有其他模型和提供商，动态激活仍然有效：Pi 会在下一次请求中正常发送当前完整激活的工具列表。模型可以调用新激活的工具，但添加其定义可能会使提供商缓存的提示前缀失效。

当激活的工具集并非纯粹“追加式”（例如用一组新工具完全替换原有工具组）时，Pi 同样会采用这一安全回退机制。因此，工具移除功能可用，但不支持延迟加载。

为获得最佳缓存效果，请在整个会话期间保持加载器工具（loader tool）始终处于激活状态，并通过“添加工具”而非“替换整个激活工具集”的方式来扩展功能。另外请注意：若使用 `promptSnippet` 或 `promptGuidelines` 激活某个工具，则会重建系统提示（system prompt）；该系统提示变更即使在提供商支持延迟加载 schema 的情况下，仍可能导致提示前缀失效。通常，延迟加载的工具应仅依赖其工具自身的 `description` 字段，而省略仅在激活时生效的提示元数据（active-only prompt metadata）。

#### 搜索工具示例

以下扩展注册了两个可搜索工具，将其从初始激活工具集中移除，并仅保留 `search_tools` 作为它们的加载器。本示例采用简单的关键词匹配，但实际搜索实现可选用 BM25、嵌入向量（embeddings）、远程目录服务或项目专属路由逻辑。

```typescript
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

const SEARCHABLE_TOOL_NAMES = new Set(["lookup_weather", "search_issues"]);

export default function (pi: ExtensionAPI) {
  pi.registerTool({
    name: "lookup_weather",
    label: "Lookup Weather",
    description: "Look up the current weather for a city",
    parameters: Type.Object({ city: Type.String() }),
    async execute(_toolCallId, params) {
      return {
        content: [{ type: "text", text: `Weather for ${params.city}: sunny` }],
        details: {},
      };
    },
  });

  pi.registerTool({
    name: "search_issues",
    label: "Search Issues",
    description: "Search project issues by keyword",
    parameters: Type.Object({ query: Type.String() }),
    async execute(_toolCallId, params) {
      return {
        content: [{ type: "text", text: `No open issues matching ${params.query}` }],
        details: {},
      };
    },
  });

  pi.registerTool({
    name: "search_tools",
    label: "Search Tools",
    description: "Search for and enable tools relevant to a task",
    promptSnippet: "Search for additional tools when the active tools cannot perform the task",
    promptGuidelines: [
      "Use search_tools when a task requires a capability that is not currently available.",
    ],
    parameters: Type.Object({
      query: Type.String({ description: "Capability or task to search for" }),
      limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 10 })),
    }),
    async execute(_toolCallId, params) {
      const terms = params.query.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
      const matches = pi.getAllTools()
        .filter((tool) => SEARCHABLE_TOOL_NAMES.has(tool.name))
        .map((tool) => ({
          tool,
          score: terms.reduce(
            (score, term) =>
              score + (`${tool.name} ${tool.description}`.toLowerCase().includes(term) ? 1 : 0),
            0,
          ),
        }))
        .filter((match) => match.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, params.limit ?? 3)
        .map((match) => match.tool.name);

      if (matches.length === 0) {
        return {
          content: [{ type: "text", text: `No tools found for: ${params.query}` }],
          details: { matches: [] },
        };
      }

      const active = pi.getActiveTools();
      const added = matches.filter((name) => !active.includes(name));
      pi.setActiveTools([...new Set([...active, ...added])]);

      return {
        content: [{
          type: "text",
          text: added.length > 0
            ? `Loaded tools: ${added.join(", ")}`
            : `Matching tools already active: ${matches.join(", ")}`,
        }],
        details: { matches, added },
      };
    },
  });

  pi.on("session_start", () => {
    // Keep searchable tools registered but initially inactive. Preserve built-ins
    // and tools owned by other extensions, and keep the loader itself active.
    const initialTools = pi.getActiveTools().filter(
      (name) => !SEARCHABLE_TOOL_NAMES.has(name),
    );
    pi.setActiveTools([...new Set([...initialTools, "search_tools"])]);
  });
}
```

当 `search_tools` 添加一个匹配项后，模型将在紧随其后的下一次请求中接收到该工具的定义。在原生支持延迟加载的模型上，该定义将锚定于搜索结果之后，且不会改动初始的工具 schema 前缀；而在其他模型上，该定义则会直接出现在该次请求所携带的标准工具列表中。

## 自定义 UI

扩展可通过 `ctx.ui` 方法与用户交互，并自定义消息及工具的渲染方式。

**如需了解自定义组件，请参阅 [tui.md](tui.md)**，其中提供了开箱即用的代码片段模板，涵盖以下功能：
- 选择对话框（SelectList）
- 支持取消的异步操作（BorderedLoader）
- 设置开关（SettingsList）
- 状态指示器（setStatus）
- 流式响应过程中的工作消息、可见性与指示器（`setWorkingMessage`、`setWorkingVisible`、`setWorkingIndicator`）
- 编辑器上方/下方的挂件（setWidget）
- 叠加于内置斜杠命令与路径补全之上的自动补全提供器（addAutocompleteProvider）
- 自定义页脚（setFooter）

### 对话框

```typescript
// Select from options
const choice = await ctx.ui.select("Pick one:", ["A", "B", "C"]);

// Confirm dialog
const ok = await ctx.ui.confirm("Delete?", "This cannot be undone");

// Text input
const name = await ctx.ui.input("Name:", "placeholder");

// Multi-line editor
const text = await ctx.ui.editor("Edit:", "prefilled text");

// Notification (non-blocking)
ctx.ui.notify("Done!", "info");  // "info" | "warning" | "error"
```

#### 带倒计时的定时对话框

对话框支持 `timeout` 选项，可在超时时自动关闭，并实时显示倒计时：

```typescript
// Dialog shows "Title (5s)" → "Title (4s)" → ... → auto-dismisses at 0
const confirmed = await ctx.ui.confirm(
  "Timed Confirmation",
  "This dialog will auto-cancel in 5 seconds. Confirm?",
  { timeout: 5000 }
);

if (confirmed) {
  // User confirmed
} else {
  // User cancelled or timed out
}
```

**超时返回值说明：**
- `select()` 返回 `undefined`
- `confirm()` 返回 `false`
- `input()` 返回 `undefined`

#### 使用 AbortSignal 手动关闭

如需更精细的控制（例如区分超时关闭与用户主动取消），可使用 `AbortSignal`：

```typescript
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 5000);

const confirmed = await ctx.ui.confirm(
  "Timed Confirmation",
  "This dialog will auto-cancel in 5 seconds. Confirm?",
  { signal: controller.signal }
);

clearTimeout(timeoutId);

if (confirmed) {
  // User confirmed
} else if (controller.signal.aborted) {
  // Dialog timed out
} else {
  // User cancelled (pressed Escape or selected "No")
}
```

完整示例请参见 [examples/extensions/timed-confirm.ts](../examples/extensions/timed-confirm.ts)。

### 挂件（Widgets）、状态与页脚（Footer）

```typescript
// Status in footer (persistent until cleared)
ctx.ui.setStatus("my-ext", "Processing...");
ctx.ui.setStatus("my-ext", undefined);  // Clear

// Working loader (shown during streaming)
ctx.ui.setWorkingMessage("Thinking deeply...");
ctx.ui.setWorkingMessage();  // Restore default
ctx.ui.setWorkingVisible(false);  // Hide the built-in working loader row entirely
ctx.ui.setWorkingVisible(true);   // Show the built-in working loader row

// Working indicator (shown during streaming)
ctx.ui.setWorkingIndicator({ frames: [ctx.ui.theme.fg("accent", "●")] });  // Static dot
ctx.ui.setWorkingIndicator({
  frames: [
    ctx.ui.theme.fg("dim", "·"),
    ctx.ui.theme.fg("muted", "•"),
    ctx.ui.theme.fg("accent", "●"),
    ctx.ui.theme.fg("muted", "•"),
  ],
  intervalMs: 120,
});
ctx.ui.setWorkingIndicator({ frames: [] });  // Hide indicator
ctx.ui.setWorkingIndicator();  // Restore default spinner

// Widget above editor (default)
ctx.ui.setWidget("my-widget", ["Line 1", "Line 2"]);
// Widget below editor
ctx.ui.setWidget("my-widget", ["Line 1", "Line 2"], { placement: "belowEditor" });
ctx.ui.setWidget("my-widget", (tui, theme) => new Text(theme.fg("accent", "Custom"), 0, 0));
ctx.ui.setWidget("my-widget", undefined);  // Clear

// Custom footer (replaces built-in footer entirely)
ctx.ui.setFooter((tui, theme) => ({
  render(width) { return [theme.fg("dim", "Custom footer")]; },
  invalidate() {},
}));
ctx.ui.setFooter(undefined);  // Restore built-in footer

// Terminal title
ctx.ui.setTitle("pi - my-project");

// Editor text
ctx.ui.setEditorText("Prefill text");
const current = ctx.ui.getEditorText();

// Paste into editor (triggers paste handling, including collapse for large content)
ctx.ui.pasteToEditor("pasted content");

// Stack custom autocomplete behavior on top of the built-in provider
ctx.ui.addAutocompleteProvider((current) => ({
  triggerCharacters: ["#"],
  async getSuggestions(lines, line, col, options) {
    const beforeCursor = (lines[line] ?? "").slice(0, col);
    const match = beforeCursor.match(/(?:^|[ \t])#([^\s#]*)$/);
    if (!match) {
      return current.getSuggestions(lines, line, col, options);
    }

    return {
      prefix: `#${match[1] ?? ""}`,
      items: [{ value: "#2983", label: "#2983", description: "Extension API for autocomplete" }],
    };
  },
  applyCompletion(lines, line, col, item, prefix) {
    return current.applyCompletion(lines, line, col, item, prefix);
  },
  shouldTriggerFileCompletion(lines, line, col) {
    return current.shouldTriggerFileCompletion?.(lines, line, col) ?? true;
  },
}));

// Tool output expansion
const wasExpanded = ctx.ui.getToolsExpanded();
ctx.ui.setToolsExpanded(true);
ctx.ui.setToolsExpanded(wasExpanded);

// Custom editor (vim mode, emacs mode, etc.)
ctx.ui.setEditorComponent((tui, theme, keybindings) => new VimEditor(tui, theme, keybindings));
const currentEditor = ctx.ui.getEditorComponent();
ctx.ui.setEditorComponent((tui, theme, keybindings) =>
  new WrappedEditor(tui, theme, keybindings, currentEditor?.(tui, theme, keybindings))
);
ctx.ui.setEditorComponent(undefined);  // Restore default editor

// Theme management (see themes.md for creating themes)
const themes = ctx.ui.getAllThemes();  // [{ name: "dark", path: "/..." | undefined }, ...]
const lightTheme = ctx.ui.getTheme("light");  // Load without switching
const result = ctx.ui.setTheme("light");  // Switch by name
if (!result.success) {
  ctx.ui.notify(`Failed: ${result.error}`, "error");
}
ctx.ui.setTheme(lightTheme!);  // Or switch by Theme object
ctx.ui.theme.fg("accent", "styled text");  // Access current theme
```

自定义工作指示器（working-indicator）框架将被原样渲染。如需添加颜色，请自行在框架字符串中插入颜色样式，例如使用 `ctx.ui.theme.fg(...)`。

### 自动补全提供器（Autocomplete Providers）

使用 `ctx.ui.addAutocompleteProvider()` 可在内置的斜杠命令与路径补全提供器之上叠加自定义的自动补全逻辑。可通过 `triggerCharacters` 设置自定义自然触发字符，例如 `$`。

典型实现模式如下：
- 检查光标前的文本内容；
- 当检测到符合本扩展特有语法的上下文时，返回您自己的补全建议；
- 否则，委托给 `current.getSuggestions(...)` 处理；
- 除非需要自定义插入行为，否则 `applyCompletion(...)` 也应委托给当前提供器处理。

```typescript
pi.on("session_start", (_event, ctx) => {
  ctx.ui.addAutocompleteProvider((current) => ({
    triggerCharacters: ["#"],
    async getSuggestions(lines, cursorLine, cursorCol, options) {
      const line = lines[cursorLine] ?? "";
      const beforeCursor = line.slice(0, cursorCol);
      const match = beforeCursor.match(/(?:^|[ \t])#([^\s#]*)$/);
      if (!match) {
        return current.getSuggestions(lines, cursorLine, cursorCol, options);
      }

      return {
        prefix: `#${match[1] ?? ""}`,
        items: [
          { value: "#2983", label: "#2983", description: "Extension API for registering custom @ autocomplete providers" },
          { value: "#2753", label: "#2753", description: "Reload stale resource settings" },
        ],
      };
    },

    applyCompletion(lines, cursorLine, cursorCol, item, prefix) {
      return current.applyCompletion(lines, cursorLine, cursorCol, item, prefix);
    },

    shouldTriggerFileCompletion(lines, cursorLine, cursorCol) {
      return current.shouldTriggerFileCompletion?.(lines, cursorLine, cursorCol) ?? true;
    },
  }));
});
```

完整示例请参见 [github-issue-autocomplete.ts](../examples/extensions/github-issue-autocomplete.ts)，该示例通过 `gh issue list` 预加载最新开放的 GitHub Issue 列表，并在本地快速过滤以支持 `#...` 形式的补全。此扩展依赖 GitHub CLI（`gh`）及已检出的 GitHub 仓库。

### 自定义组件

对于复杂 UI 场景，请使用 `ctx.ui.custom()`。该方法会临时将编辑器替换为您提供的组件，直至调用 `done()` 为止：

```typescript
import { Text, Component } from "@earendil-works/pi-tui";

const result = await ctx.ui.custom<boolean>((tui, theme, keybindings, done) => {
  const text = new Text("Press Enter to confirm, Escape to cancel", 1, 1);

  text.onKey = (key) => {
    if (key === "return") done(true);
    if (key === "escape") done(false);
    return true;
  };

  return text;
});

if (result) {
  // User pressed Enter
}
```

回调函数接收以下参数：
- `tui` —— TUI 实例（用于获取屏幕尺寸、焦点管理等）
- `theme` —— 当前主题（用于样式定制）
- `keybindings` —— 应用级快捷键管理器（用于检查快捷键绑定）
- `done(value)` —— 调用此函数以关闭组件并返回指定值

完整的组件 API 请参见 [tui.md](tui.md)。

#### 叠加模式（Overlay Mode，实验性）

传入 `{ overlay: true }` 选项，即可将组件以浮动模态框形式渲染在现有内容之上，而无需清空屏幕：```typescript
const result = await ctx.ui.custom<string | null>(
  (tui, theme, keybindings, done) => new MyOverlayComponent({ onClose: done }),
  { overlay: true }
);
```

如需高级定位（锚点、边距、百分比、响应式可见性），请传入 `overlayOptions`。使用 `onHandle` 可以以编程方式控制焦点或可见性：

```typescript
const result = await ctx.ui.custom<string | null>(
  (tui, theme, keybindings, done) => new MyOverlayComponent({ onClose: done }),
  {
    overlay: true,
    overlayOptions: { anchor: "top-right", width: "50%", margin: 2 },
    onHandle: (handle) => {
      handle.focus(); // focus this overlay and bring it to the visual front
      // handle.unfocus({ target: editorComponent }); // release input to a specific component
      // handle.setHidden(true/false); // toggle visibility
      // handle.hide(); // permanently remove
    }
  }
);
```

一个已获得焦点且可见的浮层（overlay）可在临时出现的非浮层自定义 UI 关闭后重新接管输入焦点。若您有意让其他组件在浮层保持可见的同时持续持有输入焦点，请调用 `handle.unfocus({ target })`。若传入 `{ target: null }`，则仅释放浮层焦点，而不会聚焦到其他组件。

完整 `OverlayOptions` 与 `OverlayHandle` API 详见 [tui.md](tui.md)，示例代码参见 [overlay-qa-tests.ts](../examples/extensions/overlay-qa-tests.ts)。

### 自定义编辑器

用自定义实现替换主输入编辑器（例如 Vim 模式、Emacs 模式等）：

```typescript
import { CustomEditor, type ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { matchesKey } from "@earendil-works/pi-tui";

class VimEditor extends CustomEditor {
  private mode: "normal" | "insert" = "insert";

  handleInput(data: string): void {
    if (matchesKey(data, "escape") && this.mode === "insert") {
      this.mode = "normal";
      return;
    }
    if (this.mode === "normal" && data === "i") {
      this.mode = "insert";
      return;
    }
    super.handleInput(data);  // App keybindings + text editing
  }
}

export default function (pi: ExtensionAPI) {
  pi.on("session_start", (_event, ctx) => {
    ctx.ui.setEditorComponent((tui, theme, keybindings) =>
      new VimEditor(tui, theme, keybindings)
    );
  });
}
```

**关键要点：**
- 应继承 `CustomEditor`（而非基础 `Editor` 类），以继承应用级快捷键（如 Escape 键中止、Ctrl+D、模型切换等）
- 对于未自行处理的按键，请调用 `super.handleInput(data)`
- 工厂函数接收来自应用的 `tui`、`theme` 和 `keybindings`
- 在调用 `setEditorComponent()` 前，可使用 `ctx.ui.getEditorComponent()` 获取此前已配置的自定义编辑器，以便对其进行包装
- 传入 `undefined` 可恢复默认编辑器：`ctx.ui.setEditorComponent(undefined)`

若需与另一个已替换编辑器的扩展协同工作，请在设置您自己的工厂函数前，先捕获此前的工厂函数：

```typescript
const previous = ctx.ui.getEditorComponent();
ctx.ui.setEditorComponent((tui, theme, keybindings) =>
  new MyEditor(tui, theme, keybindings, { base: previous?.(tui, theme, keybindings) })
);
```

完整带模式指示器的示例详见 [tui.md](tui.md) 中的“模式 7”。

### 消息与条目渲染

为具有您指定 `customType` 的消息注册自定义渲染器。消息渲染器适用于应参与 LLM 上下文的内容：

```typescript
import { Text } from "@earendil-works/pi-tui";

pi.registerMessageRenderer("my-extension", (message, options, theme) => {
  const { expanded, outputPad } = options;
  let text = theme.fg("accent", `[${message.customType}] `);
  text += message.content;

  if (expanded && message.details) {
    text += "\n" + theme.fg("dim", JSON.stringify(message.details, null, 2));
  }

  return new Text(text, outputPad, 0);
});
```

消息通过 `pi.sendMessage()` 发送：

```typescript
pi.sendMessage({
  customType: "my-extension",  // Matches registerMessageRenderer
  content: "Status update",
  display: true,               // Show in TUI
  details: { ... },            // Available in renderer
});
```

对于仅限 TUI 显示、且不应发送至 LLM 的内容，请改用自定义条目（entry）进行渲染：

```typescript
pi.registerEntryRenderer("my-card", (entry, options, theme) => {
  return new Text(theme.fg("accent", JSON.stringify(entry.data)));
});

pi.appendEntry("my-card", { status: "done" });
```

### 主题颜色

所有渲染函数均接收一个 `theme` 对象。有关创建自定义主题及完整配色方案，请参阅 [themes.md](themes.md)。

```typescript
// Foreground colors
theme.fg("toolTitle", text)   // Tool names
theme.fg("accent", text)      // Highlights
theme.fg("success", text)     // Success (green)
theme.fg("error", text)       // Errors (red)
theme.fg("warning", text)     // Warnings (yellow)
theme.fg("muted", text)       // Secondary text
theme.fg("dim", text)         // Tertiary text

// Text styles
theme.bold(text)
theme.italic(text)
theme.strikethrough(text)
```

在自定义工具渲染器中实现语法高亮：

```typescript
import { highlightCode, getLanguageFromPath } from "@earendil-works/pi-coding-agent";

// Highlight code with explicit language
const highlighted = highlightCode("const x = 1;", "typescript", theme);

// Auto-detect language from file path
const lang = getLanguageFromPath("/path/to/file.rs");  // "rust"
const highlighted = highlightCode(code, lang, theme);
```

## 错误处理

- 扩展产生的错误会被记录日志，代理（agent）将继续运行  
- `tool_call` 错误将导致对应工具被阻塞（安全失败机制）  
- 工具 `execute` 方法中的错误必须通过抛出异常来显式标识；该异常将被捕获，并以 `isError: true` 的形式报告给 LLM，随后执行流程继续

## 模式行为

| 模式 | `ctx.mode` | `ctx.hasUI` | 说明 |
|------|------------|-------------|------|
| 交互式（Interactive） | `"tui"` | `true` | 完整 TUI，支持终端渲染 |
| RPC 模式（`--mode rpc`） | `"rpc"` | `true` | 通过 JSON 协议显示对话框与通知；`custom()` 返回 `undefined`。详见 [rpc.md](rpc.md) |
| JSON 模式（`--mode json`） | `"json"` | `false` | 事件流输出至 stdout；所有 UI 方法均为无操作（no-op） |
| 打印模式（`-p`） | `"print"` | `false` | 扩展仍会运行，但无法发起提示（prompt） |

在使用 TUI 特有功能（如 `custom()`、组件工厂函数、终端输入）前，请先判断 `ctx.mode === "tui"`。在调用既适用于 TUI 也适用于 RPC 模式的对话框与通知方法前，请先判断 `ctx.hasUI`。

## 示例参考

所有示例位于 [examples/extensions/](../examples/extensions/) 目录下。| 示例 | 描述 | 关键 API |
|------|------|---------|
| **工具（Tools）** |||
| `hello.ts` | 最小化的工具注册示例 | `registerTool` |
| `question.ts` | 包含用户交互的工具 | `registerTool`, `ui.select` |
| `questionnaire.ts` | 多步骤向导式工具 | `registerTool`, `ui.custom` |
| `todo.ts` | 具有状态和持久化能力的工具 | `registerTool`, `appendEntry`, `renderResult`, 会话事件 |
| `dynamic-tools.ts` | 在启动后及命令执行过程中动态注册工具 | `registerTool`, `session_start`, `registerCommand` |
| `structured-output.ts` | 输出结构化结果的终结型工具（`terminate: true`） | `registerTool`, 终结型工具结果 |
| `truncated-tool.ts` | 输出截断示例 | `registerTool`, `truncateHead` |
| `tool-override.ts` | 覆盖内置的 read 工具 | `registerTool`（使用与内置工具相同的名称） |
| **命令（Commands）** |||
| `pirate.ts` | 每轮对话中修改系统提示词 | `registerCommand`, `before_agent_start` |
| `summarize.ts` | 对话摘要命令 | `registerCommand`, `ui.custom` |
| `handoff.ts` | 跨模型提供商的模型交接 | `registerCommand`, `ui.editor`, `ui.custom` |
| `qna.ts` | 带自定义 UI 的问答命令 | `registerCommand`, `ui.custom`, `setEditorText` |
| `send-user-message.ts` | 注入用户消息 | `registerCommand`, `sendUserMessage` |
| `reload-runtime.ts` | 重载命令及大语言模型（LLM）工具交接 | `registerCommand`, `ctx.reload()`, `sendUserMessage` |
| `shutdown-command.ts` | 优雅关闭命令 | `registerCommand`, `shutdown()` |
| **事件与门控（Events & Gates）** |||
| `permission-gate.ts` | 阻止危险命令执行 | `on("tool_call")`, `ui.confirm` |
| `project-trust.ts` | 决定或延迟项目信任判定（来自用户、全局设置或 CLI 扩展） | `on("project_trust")`, 信任 UI，必需返回信任结果 |
| `protected-paths.ts` | 阻止向特定路径写入 | `on("tool_call")` |
| `confirm-destructive.ts` | 确认会话变更操作 | `on("session_before_switch")`, `on("session_before_fork")` |
| `dirty-repo-guard.ts` | 在 Git 仓库存在未提交更改时发出警告 | `on("session_before_*")`, `exec` |
| `input-transform.ts` | 转换用户输入内容 | `on("input")` |
| `input-transform-streaming.ts` | 支持流式处理的输入转换 | `on("input")`, `streamingBehavior` |
| `model-status.ts` | 响应模型切换事件 | `on("model_select")`, `setStatus` |
| `provider-payload.ts` | 检查请求负载及模型提供商响应头 | `on("before_provider_request")`, `on("after_provider_response")` |
| `system-prompt-header.ts` | 显示系统提示词相关信息 | `on("agent_start")`, `getSystemPrompt` |
| `claude-rules.ts` | 从文件加载规则 | `on("session_start")`, `on("before_agent_start")` |
| `prompt-customizer.ts` | 使用 `systemPromptOptions` 添加上下文感知的工具引导 | `on("before_agent_start")`, `BuildSystemPromptOptions` |
| `file-trigger.ts` | 文件监听器触发消息发送 | `sendMessage` |
| **压缩与会话（Compaction & Sessions）** |||
| `custom-compaction.ts` | 自定义压缩摘要逻辑 | `on("session_before_compact")` |
| `trigger-compact.ts` | 手动触发会话压缩 | `compact()` |
| `git-checkpoint.ts` | 每轮对话开始时执行 Git stash | `on("turn_start")`, `on("session_before_fork")`, `exec` |
| `git-merge-and-resolve.ts` | 获取远程分支、合并并解决冲突 | `on("agent_end")`, `exec`, `sendUserMessage` |
| `auto-commit-on-exit.ts` | 关闭时自动提交变更 | `on("session_shutdown")`, `exec` |
| **UI 组件（UI Components）** |||
| `status-line.ts` | 底部状态指示器 | `setStatus`, 会话事件 |
| `working-indicator.ts` | 自定义流式处理期间的工作状态指示器 | `setWorkingIndicator`, `registerCommand` |
| `github-issue-autocomplete.ts` | 在内置自动补全基础上扩展支持 `#1234` 类型 Issue 补全（通过预加载 `gh issue list` 返回的近期开放 Issue） | `addAutocompleteProvider`, `on("session_start")`, `exec` |
| `custom-footer.ts` | 完全替换底部栏 | `registerCommand`, `setFooter` |
| `custom-header.ts` | 替换启动时的顶部横幅 | `on("session_start")`, `setHeader` |
| `modal-editor.ts` | Vim 风格模态编辑器 | `setEditorComponent`, `CustomEditor` |
| `rainbow-editor.ts` | 自定义编辑器样式 | `setEditorComponent` |
| `widget-placement.ts` | 控制组件在编辑器上方或下方显示 | `setWidget` |
| `overlay-test.ts` | 叠加层组件示例 | `ui.custom`（启用叠加选项） |
| `overlay-qa-tests.ts` | 全面的叠加层功能测试 | `ui.custom`, 所有叠加选项 |
| `notify.ts` | 简单通知功能 | `ui.notify` |
| `timed-confirm.ts` | 支持超时/信号机制的确认对话框 | `ui.confirm`（配置 timeout/signal 参数） || `mac-system-theme.ts` | 自动切换主题 | `setTheme`、`exec` |
| **复杂扩展** |||
| `plan-mode/` | 完整的计划模式实现 | 所有事件类型、`registerCommand`、`registerShortcut`、`registerFlag`、`setStatus`、`setWidget`、`sendMessage`、`setActiveTools` |
| `preset.ts` | 可保存的预设（模型、工具、思维层级） | `registerCommand`、`registerShortcut`、`registerFlag`、`setModel`、`setActiveTools`、`setThinkingLevel`、`appendEntry` |
| `tools.ts` | 工具启用/禁用的 UI 控制 | `registerCommand`、`setActiveTools`、`SettingsList`、会话事件 |
| **远程与沙箱** |||
| `ssh.ts` | SSH 远程执行 | `registerFlag`、`on("user_bash")`、`on("before_agent_start")`、工具操作 |
| `interactive-shell.ts` | 持久化 shell 会话 | `on("user_bash")` |
| `sandbox/` | 沙箱化工具执行 | 工具操作 |
| `gondolin/` | 将内置工具及 `!` 命令路由至 Gondolin 微虚拟机 | 工具操作、内置工具覆盖、`on("user_bash")` |
| `subagent/` | 启动子智能体 | `registerTool`、`exec` |
| **游戏** |||
| `snake.ts` | 贪吃蛇游戏 | `registerCommand`、`ui.custom`、键盘事件处理 |
| `space-invaders.ts` | 太空侵略者游戏 | `registerCommand`、`ui.custom` |
| `doom-overlay/` | 叠加层中的 DOOM 游戏 | 使用叠加层的 `ui.custom` |
| **提供方（Providers）** |||
| `custom-provider-anthropic/` | 自定义 Anthropic 代理 | `registerProvider` |
| `custom-provider-gitlab-duo/` | GitLab Duo 集成 | 带 OAuth 的 `registerProvider` |
| `custom-provider-zenmux/` | ZenMux（OpenAI 兼容）远程模型发现 | `registerProvider`、`refreshModels` |
| **消息与通信** |||
| `message-renderer.ts` | 自定义消息渲染 | `registerMessageRenderer`、`sendMessage` |
| `entry-renderer.ts` | 仅限 TUI 的自定义条目渲染 | `registerEntryRenderer`、`appendEntry` |
| `event-bus.ts` | 扩展间事件总线 | `pi.events` |
| **会话元数据** |||
| `session-name.ts` | 为会话选择器命名会话 | `setSessionName`、`getSessionName` |
| `bookmark.ts` | 为 `/tree` 树形视图书签条目 | `setLabel` |
| **杂项** |||
| `inline-bash.ts` | 在工具调用中内联执行 bash | `on("tool_call")` |
| `bash-spawn-hook.ts` | 在执行前调整 bash 命令、工作目录和环境变量 | `createBashTool`、`spawnHook` |
| `with-deps/` | 含 npm 依赖的扩展 | 包含 `package.json` 的包结构 |
