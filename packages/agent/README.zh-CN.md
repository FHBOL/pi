# @earendil-works/pi-agent-core

具有工具执行和事件流功能的有状态 Agent。基于 `@earendil-works/pi-ai` 构建。

## 安装

```bash
npm install @earendil-works/pi-agent-core
```

### SQLite 会话后端

SQLite 会话后端和 `node:sqlite` 适配器位于单独的包 `@earendil-works/pi-session-backend-sqlite-node` 中，因此核心包默认不会引入运行时内置模块或原生 SQLite 依赖。该后端接受一个特定运行时的 SQLite 工厂函数，使其他会话后端未来也能以独立包的形式发布。

## 快速开始

```typescript
import { Agent } from "@earendil-works/pi-agent-core";
import { createModels } from "@earendil-works/pi-ai";
import { anthropicProvider } from "@earendil-works/pi-ai/providers/anthropic";

const models = createModels();
models.setProvider(anthropicProvider());
const model = models.getModel("anthropic", "claude-sonnet-4-6");
if (!model) throw new Error("Model not found");

const agent = new Agent({
  initialState: {
    systemPrompt: "You are a helpful assistant.",
    model,
  },
  streamFn: models.streamSimple.bind(models),
});

agent.subscribe((event) => {
  if (event.type === "message_update" && event.assistantMessageEvent.type === "text_delta") {
    // 只流式输出新增的文本块
    process.stdout.write(event.assistantMessageEvent.delta);
  }
});

await agent.prompt("Hello!");
```

## 核心概念

### AgentMessage 与 LLM Message

Agent 使用 `AgentMessage` 类型，这是一种灵活的类型，可以包含：

- 标准的 LLM 消息（`user`、`assistant`、`toolResult`）
- 通过声明合并（declaration merging）定义的自定义应用专属消息类型

LLM 只能理解 `user`、`assistant` 和 `toolResult`。`convertToLlm` 函数通过在每次调用 LLM 之前过滤和转换消息来弥合这一差距。

### 消息流

```
AgentMessage[] → transformContext() → AgentMessage[] → convertToLlm() → Message[] → LLM
                    (可选)                                (必需)
```

1. **transformContext**：裁剪旧消息，注入外部上下文
2. **convertToLlm**：过滤掉仅用于 UI 的消息，将自定义类型转换为 LLM 格式

## 事件流

Agent 会发出用于更新 UI 的事件。理解事件顺序有助于构建响应式界面。

### prompt() 事件顺序

当你调用 `prompt("Hello")` 时：

```
prompt("Hello")
├─ agent_start
├─ turn_start
├─ message_start   { message: userMessage }      // 你的 prompt
├─ message_end     { message: userMessage }
├─ message_start   { message: assistantMessage } // LLM 开始响应
├─ message_update  { message: partial... }       // 流式数据块
├─ message_update  { message: partial... }
├─ message_end     { message: assistantMessage } // 完整响应
├─ turn_end        { message, toolResults: [] }
└─ agent_end       { messages: [...] }
```

### 带工具调用的情况

如果助手调用了工具，循环会继续：

```
prompt("Read config.json")
├─ agent_start
├─ turn_start
├─ message_start/end  { userMessage }
├─ message_start      { assistantMessage with toolCall }
├─ message_update...
├─ message_end        { assistantMessage }
├─ tool_execution_start  { toolCallId, toolName, args }
├─ tool_execution_update { partialResult }           // 如果工具支持流式输出
├─ tool_execution_end    { toolCallId, result }
├─ message_start/end  { toolResultMessage }
├─ turn_end           { message, toolResults: [toolResult] }
│
├─ turn_start                                        // 下一轮
├─ message_start      { assistantMessage }           // LLM 响应工具结果
├─ message_update...
├─ message_end
├─ turn_end
└─ agent_end
```

工具执行模式是可配置的：

- `parallel`（默认）：依次执行工具调用的预检（preflight），并发执行允许并发的工具，每个工具一旦完成就立即发出 `tool_execution_end`，然后按助手消息中工具调用出现的顺序发出 toolResult 消息和 `turn_end.toolResults`
- `sequential`：逐个执行工具调用，与历史行为保持一致

在并行模式下，工具完成事件按工具实际完成的顺序发出，但持久化的 toolResult 消息仍按助手消息中的原始顺序排列。

该模式可以通过 Agent 配置中的 `toolExecution` 全局设置，也可以在 `AgentTool` 上通过 `executionMode` 按工具单独设置。如果一批工具调用中有任何一个目标工具的 `executionMode` 为 `"sequential"`，那么无论全局设置如何，整批调用都会按顺序执行。

`beforeToolCall` 钩子在 `tool_execution_start` 和参数校验解析完成之后运行，它可以阻止执行。`afterToolCall` 钩子在工具执行完成之后、`tool_execution_end` 和最终工具结果消息事件发出之前运行。

工具还可以返回 `terminate: true`，以提示应跳过自动的后续 LLM 调用。只有当该批次中每一个已完成的工具结果都设置了 `terminate: true` 时，循环才会提前停止。混合批次会照常继续执行。

`Agent` 类在 `AgentOptions` 中接受 `shouldStopAfterTurn`。使用底层循环的调用者可以在 `AgentLoopConfig` 中设置相同的钩子：

```typescript
const stream = agentLoop(
  prompts,
  context,
  {
    model,
    convertToLlm,
    shouldStopAfterTurn: async ({ message, toolResults, context, newMessages }) => {
      return shouldCompactBeforeNextTurn(context.messages);
    },
  },
  undefined,
  models.streamSimple.bind(models),
);
```

`shouldStopAfterTurn` 在 `turn_end` 发出之后、且助手响应及所有工具执行都已正常完成之后运行。如果它返回 `true`，循环会发出 `agent_end` 并退出，而不会再轮询 steering 或后续（follow-up）队列，也不会再发起下一次 LLM 调用。它不会中止 provider 的流，不会取消正在运行的工具，也不会改变助手消息的停止原因（stop reason）。`AgentOptions` 的回调还会将当前运行的 `AbortSignal` 作为第二个参数传入。

当你使用 `Agent` 类时，助手 `message_end` 的处理会被当作工具预检开始前的一个屏障（barrier）。这意味着 `beforeToolCall` 看到的 Agent 状态已经包含了发起该工具调用的助手消息。

### continue() 事件顺序

`continue()` 会在不添加新消息的情况下从现有上下文继续执行。用于错误发生后的重试。

```typescript
// 出错后，从当前状态重试
await agent.continue();
```

上下文中的最后一条消息必须是 `user` 或 `toolResult`（不能是 `assistant`）。

### 事件类型

| 事件 | 说明 |
|-------|-------------|
| `agent_start` | Agent 开始处理 |
| `agent_end` | 本次运行的最终事件。该事件的被等待（awaited）订阅者仍计入结算（settlement） |
| `turn_start` | 新的一轮开始（一次 LLM 调用 + 工具执行） |
| `turn_end` | 一轮结束，携带助手消息和工具结果 |
| `message_start` | 任意消息开始（user、assistant、toolResult） |
| `message_update` | **仅限助手消息。** 包含带有增量内容的 `assistantMessageEvent` |
| `message_end` | 消息完成 |
| `tool_execution_start` | 工具开始执行 |
| `tool_execution_update` | 工具流式输出进度 |
| `tool_execution_end` | 工具执行完成 |

`Agent.subscribe()` 的监听器按注册顺序被等待（await）执行。`agent_end` 表示不会再发出更多循环事件，但 `await agent.waitForIdle()` 和 `await agent.prompt(...)` 只有在被等待的 `agent_end` 监听器执行完毕后才会完成结算。

## Agent 选项

```typescript
const agent = new Agent({
  // 初始状态
  initialState: {
    systemPrompt: string,
    model: Model<any>,
    thinkingLevel: "off" | "minimal" | "low" | "medium" | "high" | "xhigh" | "max",
    tools: AgentTool<any>[],
    messages: AgentMessage[],
  },

  // 将 AgentMessage[] 转换为 LLM Message[]（对自定义消息类型是必需的）
  convertToLlm: (messages) => messages.filter(...),

  // 在 convertToLlm 之前转换上下文（用于裁剪、压缩）
  transformContext: async (messages, signal) => pruneOldMessages(messages),

  // Steering 模式："one-at-a-time"（默认）或 "all"
  steeringMode: "one-at-a-time",

  // Follow-up 模式："one-at-a-time"（默认）或 "all"
  followUpMode: "one-at-a-time",

  // 必需的流函数
  streamFn: models.streamSimple.bind(models),

  // 用于 provider 缓存的会话 ID
  sessionId: "session-123",

  // 动态解析 API key（用于会过期的 OAuth token）
  getApiKey: async (provider) => refreshToken(),

  // 工具执行模式："parallel"（默认）或 "sequential"
  toolExecution: "parallel",

  // 在参数校验完成后对每个工具调用进行预检，可以阻止执行
  beforeToolCall: async ({ toolCall, args, context }) => {
    if (toolCall.name === "bash") {
      return { block: true, reason: "bash is disabled" };
    }
  },

  // 在最终工具事件发出之前，对每个工具结果进行后处理
  afterToolCall: async ({ toolCall, result, isError, context }) => {
    if (toolCall.name === "notify_done" && !isError) {
      return { terminate: true };
    }
    if (!isError) {
      return { details: { ...result.details, audited: true } };
    }
  },

  // 在一轮完成之后、排队消息被轮询之前，优雅地停止
  shouldStopAfterTurn: async ({ context }, signal) => {
    return shouldCompactBeforeNextTurn(context.messages, signal);
  },

  // 针对基于 token 的 provider 的自定义思考预算
  thinkingBudgets: {
    minimal: 128,
    low: 512,
    medium: 1024,
    high: 2048,
  },
});
```

## Agent 状态

```typescript
interface AgentState {
  systemPrompt: string;
  model: Model<any>;
  thinkingLevel: ThinkingLevel;
  tools: AgentTool<any>[];
  messages: AgentMessage[];
  readonly isStreaming: boolean;
  readonly streamingMessage?: AgentMessage;
  readonly pendingToolCalls: ReadonlySet<string>;
  readonly errorMessage?: string;
}
```

通过 `agent.state` 访问状态。

对 `agent.state.tools = [...]` 或 `agent.state.messages = [...]` 赋值时，会先复制顶层数组再存储。对返回的数组进行修改会直接修改当前 Agent 状态。

在流式响应过程中，`agent.state.streamingMessage` 保存当前部分完成的助手消息。

在运行完全结算（包括被等待的 `agent_end` 订阅者执行完毕）之前，`agent.state.isStreaming` 会一直保持为 `true`。

## 方法

### 发送 Prompt

```typescript
// 文本 prompt
await agent.prompt("Hello");

// 带图片
await agent.prompt("What's in this image?", [
  { type: "image", data: base64Data, mimeType: "image/jpeg" }
]);

// 直接传入 AgentMessage
await agent.prompt({ role: "user", content: "Hello", timestamp: Date.now() });

// 从当前上下文继续（最后一条消息必须是 user 或 toolResult）
await agent.continue();
```

### 状态管理

```typescript
agent.state.systemPrompt = "New prompt";
agent.state.model = getModel("openai", "gpt-4o");
agent.state.thinkingLevel = "medium";
agent.state.tools = [myTool];
agent.toolExecution = "sequential";
agent.beforeToolCall = async ({ toolCall }) => undefined;
agent.afterToolCall = async ({ toolCall, result }) => undefined;
agent.shouldStopAfterTurn = async ({ context }) => shouldCompactBeforeNextTurn(context.messages);
agent.state.messages = newMessages; // 顶层数组会被复制
agent.state.messages.push(message);
agent.reset();
```

### 会话与思考预算

```typescript
agent.sessionId = "session-123";

agent.thinkingBudgets = {
  minimal: 128,
  low: 512,
  medium: 1024,
  high: 2048,
};
```

### 控制

```typescript
agent.abort();           // 取消当前操作
await agent.waitForIdle(); // 等待完成
```

### 事件

```typescript
const unsubscribe = agent.subscribe(async (event, signal) => {
  if (event.type === "agent_end") {
    // 本次运行的最终屏障工作
    await flushSessionState(signal);
  }
});
unsubscribe();
```

## Steering 与 Follow-up

Steering 消息让你能够在工具运行期间打断 Agent。Follow-up 消息让你能够在 Agent 原本会停止的时候排队追加工作。

```typescript
agent.steeringMode = "one-at-a-time";
agent.followUpMode = "one-at-a-time";

// 当 Agent 正在运行工具时
agent.steer({
  role: "user",
  content: "Stop! Do this instead.",
  timestamp: Date.now(),
});

// 在 Agent 完成当前工作之后
agent.followUp({
  role: "user",
  content: "Also summarize the result.",
  timestamp: Date.now(),
});

const steeringMode = agent.steeringMode;
const followUpMode = agent.followUpMode;

agent.clearSteeringQueue();
agent.clearFollowUpQueue();
agent.clearAllQueues();
```

使用 clearSteeringQueue、clearFollowUpQueue 或 clearAllQueues 可以丢弃排队中的消息。

当一轮结束后检测到 steering 消息时：
1. 当前助手消息中的所有工具调用都已经执行完毕
2. 注入 steering 消息
3. LLM 在下一轮中作出响应

只有在没有更多工具调用且没有 steering 消息时，才会检查 follow-up 消息。如果有排队的 follow-up 消息，会将其注入并执行新的一轮。

## 自定义消息类型

通过声明合并（declaration merging）扩展 `AgentMessage`：

```typescript
declare module "@earendil-works/pi-agent-core" {
  interface CustomAgentMessages {
    notification: { role: "notification"; text: string; timestamp: number };
  }
}

// 现在是合法的
const msg: AgentMessage = { role: "notification", text: "Info", timestamp: Date.now() };
```

在 `convertToLlm` 中处理自定义类型：

```typescript
const agent = new Agent({
  streamFn: models.streamSimple.bind(models),
  convertToLlm: (messages) => messages.flatMap(m => {
    if (m.role === "notification") return []; // 过滤掉
    return [m];
  }),
});
```

## 工具

使用 `AgentTool` 定义工具：

```typescript
import { Type } from "typebox";

const readFileTool: AgentTool = {
  name: "read_file",
  label: "Read File",  // 用于 UI 展示
  description: "Read a file's contents",
  parameters: Type.Object({
    path: Type.String({ description: "File path" }),
  }),
  // 为该工具覆盖执行模式（可选）。
  // "sequential" 强制整批调用串行执行。
  // "parallel" 允许与其他工具调用并发执行。
  // 若省略，则采用全局的 toolExecution 配置。
  executionMode: "sequential",
  execute: async (toolCallId, params, signal, onUpdate) => {
    const content = await fs.readFile(params.path, "utf-8");

    // 可选：流式输出进度
    onUpdate?.({ content: [{ type: "text", text: "Reading..." }], details: {} });

    // 可选：在此处添加 `terminate: true`，当批次中所有已完成的工具结果
    // 都这样做时，可跳过自动的后续 LLM 调用。
    return {
      content: [{ type: "text", text: content }],
      details: { path: params.path, size: content.length },
    };
  },
};

agent.state.tools = [readFileTool];
```

### 错误处理

工具失败时**抛出错误**。不要把错误信息作为 content 返回。

```typescript
execute: async (toolCallId, params, signal, onUpdate) => {
  if (!fs.existsSync(params.path)) {
    throw new Error(`File not found: ${params.path}`);
  }
  // 仅在成功时返回 content
  return { content: [{ type: "text", text: "..." }] };
}
```

抛出的错误会被 Agent 捕获，并作为 `isError: true` 的工具错误上报给 LLM。

从 `execute()` 或 `afterToolCall` 返回 `terminate: true`，以提示 Agent 应在当前工具批次之后停止。只有当该批次中每一个已完成的工具结果都是终止性的时，这个提示才会生效。该提示仅在运行时生效；发出的 `toolResult` 记录消息仍然是标准的 LLM 工具结果。

## 代理（Proxy）用法

对于通过后端代理的浏览器应用：

```typescript
import { Agent, streamProxy } from "@earendil-works/pi-agent-core";

const agent = new Agent({
  streamFn: (model, context, options) =>
    streamProxy(model, context, {
      ...options,
      authToken: "...",
      proxyUrl: "https://your-server.com",
    }),
});
```

## 底层 API

如果不使用 Agent 类而需要直接控制：

```typescript
import { agentLoop, agentLoopContinue } from "@earendil-works/pi-agent-core";

const context: AgentContext = {
  systemPrompt: "You are helpful.",
  messages: [],
  tools: [],
};

const config: AgentLoopConfig = {
  model: getModel("openai", "gpt-4o"),
  convertToLlm: (msgs) => msgs.filter(m => ["user", "assistant", "toolResult"].includes(m.role)),
  toolExecution: "parallel",  // 如果设置了按工具的 executionMode，则会覆盖此项
  beforeToolCall: async ({ toolCall, args, context }) => undefined,
  afterToolCall: async ({ toolCall, result, isError, context }) => undefined,
};

const userMessage = { role: "user", content: "Hello", timestamp: Date.now() };

const streamFn = models.streamSimple.bind(models);
for await (const event of agentLoop([userMessage], context, config, undefined, streamFn)) {
  console.log(event.type);
}

// 从现有上下文继续
for await (const event of agentLoopContinue(context, config, undefined, streamFn)) {
  console.log(event.type);
}
```

这些底层的流是可观测（observational）的。它们保留事件顺序，但不会在发出下一阶段事件之前等待你的异步事件处理逻辑执行完成。如果你需要消息处理充当工具预检之前的屏障（barrier），请使用 `Agent` 类，而不是直接使用底层的 `agentLoop()` 或 `agentLoopContinue()`。

## 许可证

MIT
