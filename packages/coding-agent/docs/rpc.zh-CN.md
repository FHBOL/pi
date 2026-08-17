# RPC 模式

RPC 模式通过标准输入/输出（stdin/stdout）上的 JSON 协议，实现编码智能体（coding agent）的无界面（headless）运行。该模式适用于将智能体嵌入其他应用程序、集成开发环境（IDE）或自定义用户界面（UI）中。

**面向 Node.js/TypeScript 用户的说明**：若您正在构建 Node.js 应用程序，建议直接从 `@earendil-works/pi-coding-agent` 包中导入并使用 `AgentSession`，而非启动子进程。API 定义详见 [`src/core/agent-session.ts`](../src/core/agent-session.ts)。若需基于子进程的 TypeScript 客户端示例，请参阅 [`src/modes/rpc/rpc-client.ts`](../src/modes/rpc/rpc-client.ts)。

## 启动 RPC 模式

```bash
pi --mode rpc [options]
```

常用选项：
- `--provider <name>`：设置大语言模型（LLM）提供商（如 anthropic、openai、google 等）
- `--model <pattern>`：模型名称模式或 ID（支持 `provider/id` 格式，以及可选的 `:<thinking>` 后缀）
- `--name <name>` / `-n <name>`：在启动时设置会话显示名称
- `--no-session`：禁用会话持久化
- `--session-dir <path>`：自定义会话存储目录

## 协议概览

- **命令（Commands）**：以 JSON 对象形式发送至标准输入（stdin），每行一个对象  
- **响应（Responses）**：以 JSON 对象形式返回，含 `type: "response"` 字段，用于指示命令执行成功或失败  
- **事件（Events）**：智能体产生的各类事件以 JSON 行格式持续流式输出至标准输出（stdout）

所有命令均支持可选的 `id` 字段，用于请求与响应之间的关联。若提供了 `id`，则对应响应中将包含相同的 `id`。`bash_execution_update` 类型事件亦包含其源 `bash` 命令的 `id`。

### 数据帧格式（Framing）

RPC 模式严格遵循 JSONL（JSON Lines）语义，仅以换行符（LF，`\n`）作为记录分隔符。

这对客户端实现有重要影响：
- 仅依据 `\n` 分割记录  
- 允许接收可选的 `\r\n` 输入，并自动移除末尾的 `\r`  
- 不得使用通用行读取器（generic line readers），因其可能将 Unicode 分隔符（如 `U+2028` 和 `U+2029`）也识别为换行符  

特别注意：Node.js 的 `readline` 模块不符合 RPC 模式协议规范，因为它还会将 `U+2028`（行分隔符）和 `U+2029`（段落分隔符）视为换行符——而这两个 Unicode 字符在 JSON 字符串内部是合法且有效的。

## 命令（Commands）

### 提示（Prompting）

#### prompt

向智能体发送一条用户提示（prompt）。该命令的响应将在提示被接受、入队或处理后立即发出；提示被接受后，事件仍将持续异步流式输出。

```json
{"id": "req-1", "type": "prompt", "message": "Hello, world!"}
```

携带图像时：
```json
{"type": "prompt", "message": "What's in this image?", "images": [{"type": "image", "data": "base64-encoded-data", "mimeType": "image/png"}]}
```

**流式传输期间（During streaming）**：若智能体当前正处于流式响应状态，则必须指定 `streamingBehavior` 参数，以决定如何对新消息进行排队：

```json
{"type": "prompt", "message": "New instruction", "streamingBehavior": "steer"}
```

- `"steer"`：在智能体运行期间将消息入队。该消息将在当前助手轮次（assistant turn）完成其工具调用（tool calls）后、下一次大语言模型（LLM）调用前送达。  
- `"followUp"`：等待智能体完全结束运行后再投递消息。该消息仅在智能体停止后才被处理。

若智能体正处于流式响应状态，且未指定 `streamingBehavior`，则该命令将返回错误。

**扩展命令（Extension commands）**：若消息为扩展命令（例如 `/mycommand`），则即使在流式响应期间也会立即执行。扩展命令通过 `pi.sendMessage()` 自行管理与 LLM 的交互过程。

**输入展开（Input expansion）**：技能命令（`/skill:name`）与提示模板（`/template`）会在发送或入队前自动展开。

响应格式：
```json
{"id": "req-1", "type": "response", "command": "prompt", "success": true}
```

`success: true` 表示提示已被接受、入队或立即处理；`success: false` 表示提示在被接受前即遭拒绝。提示被接受后的失败情况（如工具调用失败等）将通过常规事件流与消息流上报，而不会为同一请求 ID 再次返回 `response` 类型响应。

`images` 字段为可选字段。每个图像采用 `ImageContent` 格式：`{"type": "image", "data": "base64-encoded-data", "mimeType": "image/png"}`。

#### steer

在智能体运行期间排队一条“引导”（steering）消息。该消息将在当前助手轮次完成其全部工具调用后、下一次 LLM 调用前送达。技能命令与提示模板将被自动展开；扩展命令不被允许（请改用 `prompt` 命令）。

```json
{"type": "steer", "message": "Stop and do this instead"}
```

携带图像时：
```json
{"type": "steer", "message": "Look at this instead", "images": [{"type": "image", "data": "base64-encoded-data", "mimeType": "image/png"}]}
```

`images` 字段为可选字段。每个图像采用 `ImageContent` 格式（同 `prompt` 命令）。

响应格式：
```json
{"type": "response", "command": "steer", "success": true}
```

有关如何控制引导消息的处理方式，请参见 [set_steering_mode](#set_steering_mode)。

#### follow_up

排队一条“后续”（follow-up）消息，待智能体完全结束后再处理。该消息仅在智能体不再有未完成的工具调用或待处理的引导消息时才被投递。技能命令与提示模板将被自动展开；扩展命令不被允许（请改用 `prompt` 命令）。

```json
{"type": "follow_up", "message": "After you're done, also do this"}
```

携带图像时：
```json
{"type": "follow_up", "message": "Also check this image", "images": [{"type": "image", "data": "base64-encoded-data", "mimeType": "image/png"}]}
```

`images` 字段为可选字段。每个图像采用 `ImageContent` 格式（同 `prompt` 命令）。

响应格式：
```json
{"type": "response", "command": "follow_up", "success": true}
```

有关如何控制后续消息的处理方式，请参见 [set_follow_up_mode](#set_follow_up_mode)。

#### abort

中止当前的智能体操作。

```json
{"type": "abort"}
```

响应：
```json
{"type": "response", "command": "abort", "success": true}
```

#### new_session

启动一个全新的会话。可通过 `session_before_switch` 扩展事件处理器取消该操作。

```json
{"type": "new_session"}
```

支持可选的父会话追踪：
```json
{"type": "new_session", "parentSession": "/path/to/parent-session.jsonl"}
```

响应：
```json
{"type": "response", "command": "new_session", "success": true, "data": {"cancelled": false}}
```

若扩展程序已取消该操作：
```json
{"type": "response", "command": "new_session", "success": true, "data": {"cancelled": true}}
```

### 状态（State）

#### get_state

获取当前会话状态。

```json
{"type": "get_state"}
```

响应：
```json
{
  "type": "response",
  "command": "get_state",
  "success": true,
  "data": {
    "model": {...},
    "thinkingLevel": "medium",
    "isStreaming": false,
    "isCompacting": false,
    "steeringMode": "all",
    "followUpMode": "one-at-a-time",
    "sessionFile": "/path/to/session.jsonl",
    "sessionId": "abc123",
    "sessionName": "my-feature-work",
    "autoCompactionEnabled": true,
    "messageCount": 5,
    "pendingMessageCount": 0
  }
}
```

`model` 字段为完整的 [Model](#model) 对象或 `null`；`sessionName` 字段为通过 `set_session_name` 设置的显示名称，若未设置则该字段被省略。

#### get_messages

获取对话中的所有消息。

```json
{"type": "get_messages"}
```

响应：
```json
{
  "type": "response",
  "command": "get_messages",
  "success": true,
  "data": {"messages": [...]}
}
```

消息为 `AgentMessage` 类型对象（参见 [消息类型](#message-types)）。

### 模型（Model）

#### set_model

切换至指定模型。

```json
{"type": "set_model", "provider": "anthropic", "modelId": "claude-sonnet-4-20250514"}
```

响应中包含完整的 [Model](#model) 对象：
```json
{
  "type": "response",
  "command": "set_model",
  "success": true,
  "data": {...}
}
```

#### cycle_model

循环切换至下一个可用模型。若仅配置了一个模型，则返回 `null` 数据。

```json
{"type": "cycle_model"}
```

响应：
```json
{
  "type": "response",
  "command": "cycle_model",
  "success": true,
  "data": {
    "model": {...},
    "thinkingLevel": "medium",
    "isScoped": false
  }
}
```

`model` 字段为完整的 [Model](#model) 对象。

#### get_available_models

列出所有已配置的模型。

```json
{"type": "get_available_models"}
```

响应中包含一个完整 [Model](#model) 对象数组：
```json
{
  "type": "response",
  "command": "get_available_models",
  "success": true,
  "data": {
    "models": [...]
  }
}
```

### 推理能力（Thinking）

#### set_thinking_level

为支持推理/思考能力的模型设置其推理/思考等级。

```json
{"type": "set_thinking_level", "level": "high"}
```

等级取值：`"off"`、`"minimal"`、`"low"`、`"medium"`、`"high"`、`"xhigh"`、`"max"`

`"xhigh"` 和 `"max"` 仅在所选模型支持时才对外暴露。部分模型（包括 GPT-5.6）同时支持这两个等级。

响应：
```json
{"type": "response", "command": "set_thinking_level", "success": true}
```

#### cycle_thinking_level

在当前模型支持的推理等级之间循环切换。若模型不支持推理能力，则返回 `null` 数据。

```json
{"type": "cycle_thinking_level"}
```

响应：
```json
{
  "type": "response",
  "command": "cycle_thinking_level",
  "success": true,
  "data": {"level": "high"}
}
```

#### get_available_thinking_levels

列出当前模型所支持的推理等级。对于不支持推理能力的模型，返回 `["off"]`。

```json
{"type": "get_available_thinking_levels"}
```

响应：
```json
{
  "type": "response",
  "command": "get_available_thinking_levels",
  "success": true,
  "data": {
    "levels": ["off", "minimal", "low", "medium", "high"]
  }
}
```

### 队列模式（Queue Modes）

#### set_steering_mode

控制转向消息（来自 `steer`）的投递方式。

```json
{"type": "set_steering_mode", "mode": "one-at-a-time"}
```

模式说明：
- `"all"`：在当前助手回合完成其工具调用后，一次性投递全部转向消息；
- `"one-at-a-time"`：每个助手回合完成后投递一条转向消息（默认模式）。

响应：
```json
{"type": "response", "command": "set_steering_mode", "success": true}
```

#### set_follow_up_mode

控制后续消息（来自 `follow_up`）的投递方式。

```json
{"type": "set_follow_up_mode", "mode": "one-at-a-time"}
```

模式说明：
- `"all"`：智能体完成全部处理后，一次性投递全部后续消息；
- `"one-at-a-time"`：每次智能体完成一个回合后投递一条后续消息（默认模式）。

响应：
```json
{"type": "response", "command": "set_follow_up_mode", "success": true}
```

### 上下文压缩（Compaction）

#### compact

手动压缩对话上下文以减少 token 消耗。

```json
{"type": "compact"}
```

支持自定义压缩指令：
```json
{"type": "compact", "customInstructions": "Focus on code changes"}
```

响应：
```json
{
  "type": "response",
  "command": "compact",
  "success": true,
  "data": {
    "summary": "Summary of conversation...",
    "firstKeptEntryId": "abc123",
    "tokensBefore": 150000,
    "estimatedTokensAfter": 32000,
    "usage": {
      "input": 32000,
      "output": 1200,
      "cacheRead": 0,
      "cacheWrite": 0,
      "totalTokens": 33200,
      "cost": {"input": 0.01, "output": 0.02, "cacheRead": 0, "cacheWrite": 0, "total": 0.03}
    },
    "details": {}
  }
}
```

`estimatedTokensAfter` 是压缩后重建的消息上下文的启发式 token 数估算值，并非由模型提供商提供的精确 token 计数；`usage` 字段报告生成摘要所调用的 LLM 请求（或多个请求），但自定义压缩处理器可能省略该字段。

#### set_auto_compaction

启用或禁用上下文接近满载时的自动压缩功能。

```json
{"type": "set_auto_compaction", "enabled": true}
```

响应：
```json
{"type": "response", "command": "set_auto_compaction", "success": true}
```

### 重试（Retry）

#### set_auto_retry

启用或禁用对临时性错误（如服务过载、速率限制、HTTP 5xx 错误）的自动重试。

```json
{"type": "set_auto_retry", "enabled": true}
```

响应：
```json
{"type": "response", "command": "set_auto_retry", "success": true}
```

#### abort_retry

中止正在进行的重试操作（取消等待延迟并停止重试）。

```json
{"type": "abort_retry"}
```

响应：
```json
{"type": "response", "command": "abort_retry", "success": true}
```

### Bash

#### bash

执行 Shell 命令，并将输出添加至对话上下文中。命令运行期间，输出以 `bash_execution_update` 事件形式流式传输；响应中包含最终执行结果。

```json
{"id": "req-1", "type": "bash", "command": "ls -la"}
```

可指定 `id` 字段，用于将流式传输的 `bash_execution_update` 事件与本次命令关联。

响应：
```json
{
  "id": "req-1",
  "type": "response",
  "command": "bash",
  "success": true,
  "data": {
    "output": "total 48\ndrwxr-xr-x ...",
    "exitCode": 0,
    "cancelled": false,
    "truncated": false
  }
}
```

若输出被截断，则响应中额外包含 `fullOutputPath` 字段：
```json
{
  "type": "response",
  "command": "bash",
  "success": true,
  "data": {
    "output": "truncated output...",
    "exitCode": 0,
    "cancelled": false,
    "truncated": true,
    "fullOutputPath": "/tmp/pi-bash-abc123.log"
  }
}
```

**Bash 结果如何传递给大语言模型（LLM）：**

`bash` 命令立即执行并返回一个 `BashResult`。内部会创建一个 `BashExecutionMessage` 并存储于智能体的消息状态中。

当发送下一个 `prompt` 命令时，所有消息（包括 `BashExecutionMessage`）会在提交给 LLM 前被转换。其中 `BashExecutionMessage` 将被转换为格式如下所示的 `UserMessage`：

````
Ran `ls -la`
```
total 48
drwxr-xr-x ...
```
````

这意味着：
1. Bash 输出将在 **下一次 prompt** 中纳入 LLM 的上下文，而非立即生效；
2. 可在一次 prompt 前连续执行多个 bash 命令；所有命令的输出均会被一并纳入上下文。

#### abort_bash

中止正在运行的 bash 命令。```json
{"type": "abort_bash"}
```

响应：
```json
{"type": "response", "command": "abort_bash", "success": true}
```

### 会话（Session）

#### get_session_stats

获取 token 使用量、费用统计信息以及当前上下文窗口使用情况。

```json
{"type": "get_session_stats"}
```

响应：
```json
{
  "type": "response",
  "command": "get_session_stats",
  "success": true,
  "data": {
    "sessionFile": "/path/to/session.jsonl",
    "sessionId": "abc123",
    "userMessages": 5,
    "assistantMessages": 5,
    "toolCalls": 12,
    "toolResults": 12,
    "totalMessages": 22,
    "tokens": {
      "input": 50000,
      "output": 10000,
      "cacheRead": 40000,
      "cacheWrite": 5000,
      "total": 105000
    },
    "cost": 0.45,
    "contextUsage": {
      "tokens": 60000,
      "contextWindow": 200000,
      "percent": 30
    }
  }
}
```

`tokens` 和 `cost` 字段包含助手消息、工具所报告的用量，以及整个会话中压缩（compaction）和分支摘要（branch-summary）生成所产生的用量。`contextUsage` 字段则包含实际用于压缩和页脚显示的当前上下文窗口估算值。

当未配置模型或上下文窗口不可用时，`contextUsage` 字段将被省略。在执行完一次压缩操作后，`contextUsage.tokens` 和 `contextUsage.percent` 的值为 `null`，直至下一条压缩后的助手响应提供了有效的用量数据。

#### export_html

将当前会话导出为 HTML 文件。

```json
{"type": "export_html"}
```

指定自定义路径：
```json
{"type": "export_html", "outputPath": "/tmp/session.html"}
```

响应：
```json
{
  "type": "response",
  "command": "export_html",
  "success": true,
  "data": {"path": "/tmp/session.html"}
}
```

#### switch_session

加载另一个会话文件。该操作可由 `session_before_switch` 扩展事件处理器取消。

```json
{"type": "switch_session", "sessionPath": "/path/to/session.jsonl"}
```

响应：
```json
{"type": "response", "command": "switch_session", "success": true, "data": {"cancelled": false}}
```

若扩展程序取消了切换操作：
```json
{"type": "response", "command": "switch_session", "success": true, "data": {"cancelled": true}}
```

#### fork

从当前活跃分支上的某条先前用户消息创建一个新的分支（fork）。该操作可由 `session_before_fork` 扩展事件处理器取消。返回被分叉（forked from）的那条消息的文本内容。

```json
{"type": "fork", "entryId": "abc123"}
```

响应：
```json
{
  "type": "response",
  "command": "fork",
  "success": true,
  "data": {"text": "The original prompt text...", "cancelled": false}
}
```

若扩展程序取消了分叉操作：
```json
{
  "type": "response",
  "command": "fork",
  "success": true,
  "data": {"text": "The original prompt text...", "cancelled": true}
}
```

#### clone

在当前位置将当前活跃分支完整复制到一个新会话中。该操作可由 `session_before_fork` 扩展事件处理器取消。

```json
{"type": "clone"}
```

响应：
```json
{
  "type": "response",
  "command": "clone",
  "success": true,
  "data": {"cancelled": false}
}
```

若扩展程序取消了克隆操作：
```json
{
  "type": "response",
  "command": "clone",
  "success": true,
  "data": {"cancelled": true}
}
```

#### get_fork_messages

获取可用于分叉（fork）的用户消息列表。

```json
{"type": "get_fork_messages"}
```

响应：
```json
{
  "type": "response",
  "command": "get_fork_messages",
  "success": true,
  "data": {
    "messages": [
      {"entryId": "abc123", "text": "First prompt..."},
      {"entryId": "def456", "text": "Second prompt..."}
    ]
  }
}
```

#### get_entries

按追加顺序（append order）获取所有会话条目（不包括会话头部）。会话是一个具有稳定 ID 的仅追加（append-only）条目树，因此条目 ID 可作为持久化游标（durable cursor）使用：将您上次已知的最后一条条目 ID 作为 `since` 参数传入，即可仅获取严格在其之后的新条目（即使客户端重启后也依然有效）。与 `get_messages` 不同，此方法包含压缩前的历史记录以及已被放弃的分支。

```json
{"type": "get_entries"}
```

带游标参数：
```json
{"type": "get_entries", "since": "abc123"}
```

响应：
```json
{
  "type": "response",
  "command": "get_entries",
  "success": true,
  "data": {
    "entries": [
      {"type": "message", "id": "def456", "parentId": "abc123", "timestamp": "...", "message": {"role": "user", "...": "..."}}
    ],
    "leafId": "def456"
  }
}
```

`leafId` 是当前叶节点条目的 ID（空会话时为 `null`），因此客户端可通过一次往返通信判断活跃分支是否已移动。若 `since` 参数所指定的 ID 在会话中不存在，则响应中 `success` 字段为 `false`。

#### get_tree

以树形结构返回整个会话条目。每个节点格式为 `{entry, children, label?, labelTimestamp?}`。一个结构良好的会话应有且仅有一个根节点；而孤立条目（即父链断裂的条目）也会作为根节点出现在结果中。

```json
{"type": "get_tree"}
```

响应：
```json
{
  "type": "response",
  "command": "get_tree",
  "success": true,
  "data": {
    "tree": [
      {
        "entry": {"type": "message", "id": "abc123", "parentId": null, "...": "..."},
        "children": [
          {"entry": {"type": "message", "id": "def456", "parentId": "abc123", "...": "..."}, "children": []}
        ]
      }
    ],
    "leafId": "def456"
  }
}
```

#### get_last_assistant_text

获取最后一条助手消息的纯文本内容。

```json
{"type": "get_last_assistant_text"}
```

响应：
```json
{
  "type": "response",
  "command": "get_last_assistant_text",
  "success": true,
  "data": {"text": "The assistant's response..."}
}
```

若尚无任何助手消息，则返回 `{"text": null}`。

#### set_session_name

为当前会话设置一个显示名称。该名称将出现在会话列表中，有助于识别不同会话。

```json
{"type": "set_session_name", "name": "my-feature-work"}
```

响应：
```json
{
  "type": "response",
  "command": "set_session_name",
  "success": true
}
```

当前会话名称可通过 `get_state` 方法在 `sessionName` 字段中获取。若要在启动 RPC 模式时设置初始会话名，请向 `pi --mode rpc` 进程传递 `--name <name>` 或 `-n <name>` 参数。

### 命令（Commands）

#### get_commands

获取所有可用命令（包括扩展命令、提示模板和技能）。这些命令可通过 `prompt` 命令调用，调用时需在命令名前加上 `/` 前缀。

```json
{"type": "get_commands"}
```

响应：
```json
{
  "type": "response",
  "command": "get_commands",
  "success": true,
  "data": {
    "commands": [
      {"name": "session-name", "description": "Set or clear session name", "source": "extension", "path": "/home/user/.pi/agent/extensions/session.ts"},
      {"name": "fix-tests", "description": "Fix failing tests", "source": "prompt", "location": "project", "path": "/home/user/myproject/.pi/agent/prompts/fix-tests.md"},
      {"name": "skill:brave-search", "description": "Web search via Brave API", "source": "skill", "location": "user", "path": "/home/user/.pi/agent/skills/brave-search/SKILL.md"}
    ]
  }
}
```

每条命令包含以下字段：
- `name`：命令名称（调用方式为 `/name`）
- `description`：人类可读的描述（扩展命令可选）
- `source`：命令类型：
  - `"extension"`：通过扩展中的 `pi.registerCommand()` 注册
  - `"prompt"`：从提示模板 `.md` 文件加载
  - `"skill"`：从技能目录加载（其名称以 `skill:` 为前缀）
- `location`：命令加载位置（扩展命令不包含此字段，为可选字段）：
  - `"user"`：用户级目录（`~/.pi/agent/`）
  - `"project"`：项目级目录（`./.pi/agent/`）
  - `"path"`：通过 CLI 或配置显式指定的路径
- `path`：命令源文件的绝对路径（可选）

**注意**：内置 TUI 命令（如 `/settings`、`/hotkeys` 等）不在此列表中。它们仅在交互模式下处理，若通过 `prompt` 发送则不会执行。

## 事件（Events）

在智能体（agent）运行期间，事件将以 JSON 行（JSON lines）形式流式输出至标准输出（stdout）。事件通常不包含 `id` 字段；但 `bash_execution_update` 事件会在其原始 `bash` 命令已提供 `id` 时，包含该 `id` 字段。

### 事件类型

| 事件 | 描述 |
|------|------|
| `agent_start` | Agent 开始处理请求 |
| `agent_end` | 一次底层 Agent 运行完成（后续仍可能触发自动重试、压缩重试或排队的延续操作） |
| `agent_settled` | Agent 运行已完全结束；不再有自动重试、压缩重试或排队的延续操作 |
| `turn_start` | 新一轮对话开始 |
| `turn_end` | 当前轮次完成（包含助手消息及工具执行结果） |
| `message_start` | 消息开始生成 |
| `message_update` | 流式更新（文本/思考过程/工具调用的增量内容） |
| `message_end` | 消息生成完成 |
| `bash_execution_update` | 直接 RPC 方式执行 bash 命令时，每输出一个数据块即触发一次 |
| `tool_execution_start` | 工具开始执行 |
| `tool_execution_update` | 工具执行过程中的进度更新（流式输出） |
| `tool_execution_end` | 工具执行完成 |
| `queue_update` | 待处理的引导指令或后续操作队列发生变化 |
| `compaction_start` | 压缩操作开始 |
| `compaction_end` | 压缩操作完成 |
| `auto_retry_start` | 自动重试开始（因临时性错误触发） |
| `auto_retry_end` | 自动重试完成（成功或最终失败） |
| `summarization_retry_scheduled` | 针对临时性压缩错误或分支摘要错误，已调度摘要重试 |
| `summarization_retry_attempt_start` | 重试的摘要请求开始执行 |
| `summarization_retry_finished` | 摘要重试循环完成 |
| `extension_error` | 扩展模块抛出错误 |

### agent_start

当 Agent 开始处理提示词（prompt）时触发。

```json
{"type": "agent_start"}
```

### agent_end

当一次底层 Agent 运行完成时触发。该事件包含本次运行中生成的所有消息。若 `willRetry` 字段为 `true`，则后续将自动发起重试。

```json
{
  "type": "agent_end",
  "messages": [...],
  "willRetry": false
}
```

### agent_settled

在完整会话级运行完全结束时触发。此时 Pi 不会再通过自动重试、压缩重试或排队的后续消息继续执行。

```json
{"type": "agent_settled"}
```

### turn_start / turn_end

一轮（turn）包含一次助手响应，以及由此产生的任意工具调用及其结果。

```json
{"type": "turn_start"}
```

```json
{
  "type": "turn_end",
  "message": {...},
  "toolResults": [...]
}
```

### message_start / message_end

当一条消息开始生成和完成生成时分别触发。`message` 字段包含一个 `AgentMessage` 对象。

```json
{"type": "message_start", "message": {...}}
{"type": "message_end", "message": {...}}
```

### message_update（流式传输）

在助手消息流式传输过程中触发。该事件仅包含增量更新（delta event），不包含累积的消息快照。

```json
{
  "type": "message_update",
  "assistantMessageEvent": {
    "type": "text_delta",
    "contentIndex": 0,
    "delta": "Hello "
  }
}
```

`assistantMessageEvent` 字段包含以下某一种增量类型：

| 类型 | 描述 |
|------|------|
| `text_start` | 文本内容块开始 |
| `text_delta` | 文本内容片段 |
| `text_end` | 文本内容块结束 |
| `thinking_start` | 思考内容块开始 |
| `thinking_delta` | 思考内容片段 |
| `thinking_end` | 思考内容块结束 |
| `toolcall_start` | 工具调用开始 |
| `toolcall_delta` | 工具调用参数片段 |
| `toolcall_end` | 工具调用结束（包含完整的 `toolCall` 对象） |

示例：流式传输一段纯文本响应：
```json
{"type":"message_update","assistantMessageEvent":{"type":"text_start","contentIndex":0}}
{"type":"message_update","assistantMessageEvent":{"type":"text_delta","contentIndex":0,"delta":"Hello"}}
{"type":"message_update","assistantMessageEvent":{"type":"text_delta","contentIndex":0,"delta":" world"}}
{"type":"message_update","assistantMessageEvent":{"type":"text_end","contentIndex":0,"content":"Hello world"}}
```

`message_update` 故意省略了旧版中累积的 `message` 字段和 `assistantMessageEvent.partial` 字段。  
需要实时获取部分消息（partial message）的客户端，必须结合 `message_start` 及其后的所有事件，利用 `contentIndex` 字段自行组装。应以 `message_end.message` 中的内容为准。  
对于工具调用，请缓存 `toolcall_delta.delta`；而 `toolcall_end.toolCall` 则包含已完成的完整调用对象。

### bash_execution_update

每次直接执行 `bash` 命令并输出一个数据块时触发一次。`id` 字段与对应命令的 `id` 一致，便于客户端将输出与正确的命令关联。

该事件会在命令执行期间持续流式输出全部内容，即使最终 `bash` 响应中的 `output` 字段被截断。

```json
{
  "type": "bash_execution_update",
  "id": "req-1",
  "delta": "total 48\n"
}
```

### tool_execution_start / tool_execution_update / tool_execution_end

当工具开始执行、流式输出执行进度、以及执行完成时分别触发。

```json
{
  "type": "tool_execution_start",
  "toolCallId": "call_abc123",
  "toolName": "bash",
  "args": {"command": "ls -la"}
}
```

执行过程中，`tool_execution_update` 事件会流式输出部分结果（例如：bash 输出内容随到达而逐步发出）：

```json
{
  "type": "tool_execution_update",
  "toolCallId": "call_abc123",
  "toolName": "bash",
  "args": {"command": "ls -la"},
  "partialResult": {
    "content": [{"type": "text", "text": "partial output so far..."}],
    "details": {"truncation": null, "fullOutputPath": null}
  }
}
```

执行完成后：

```json
{
  "type": "tool_execution_end",
  "toolCallId": "call_abc123",
  "toolName": "bash",
  "result": {
    "content": [{"type": "text", "text": "total 48\n..."}],
    "details": {...}
  },
  "isError": false
}
```

请使用 `toolCallId` 字段关联各事件。`tool_execution_update` 中的 `partialResult` 字段包含截至目前已累积的全部输出（而非仅本次增量），客户端可在每次更新时直接替换当前显示内容。

### queue_update

每当待处理的引导指令或后续操作队列发生变化时触发。

```json
{
  "type": "queue_update",
  "steering": ["Focus on error handling"],
  "followUp": ["After that, summarize the result"]
}
```

### compaction_start / compaction_end

无论手动还是自动触发，只要发生压缩操作，均会触发这两个事件。

```json
{"type": "compaction_start", "reason": "threshold"}
```

`reason` 字段取值为 `"manual"`（手动）、`"threshold"`（达到阈值）或 `"overflow"`（溢出）。```json
{
  "type": "compaction_end",
  "reason": "threshold",
  "result": {
    "summary": "Summary of conversation...",
    "firstKeptEntryId": "abc123",
    "tokensBefore": 150000,
    "estimatedTokensAfter": 32000,
    "usage": {
      "input": 32000,
      "output": 1200,
      "cacheRead": 0,
      "cacheWrite": 0,
      "totalTokens": 33200,
      "cost": {"input": 0.01, "output": 0.02, "cacheRead": 0, "cacheWrite": 0, "total": 0.03}
    },
    "details": {}
  },
  "aborted": false,
  "willRetry": false
}
```

若 `reason` 为 `"overflow"` 且压缩操作成功，则 `willRetry` 为 `true`，代理将自动重试该提示。

若压缩操作被中止，则 `result` 为 `null`，且 `aborted` 为 `true`。

若压缩操作失败（例如 API 配额已超出），则 `result` 为 `null`，`aborted` 为 `false`，且 `errorMessage` 字段包含错误描述。

### auto_retry_start / auto_retry_end

当因临时性错误（服务过载、速率限制、5xx 状态码）触发自动重试时发出。

```json
{
  "type": "auto_retry_start",
  "attempt": 1,
  "maxAttempts": 3,
  "delayMs": 2000,
  "errorMessage": "529 {\"type\":\"error\",\"error\":{\"type\":\"overloaded_error\",\"message\":\"Overloaded\"}}"
}
```

```json
{
  "type": "auto_retry_end",
  "success": true,
  "attempt": 2
}
```

在最终失败（重试次数已达上限）时：
```json
{
  "type": "auto_retry_end",
  "success": false,
  "attempt": 3,
  "finalError": "529 overloaded_error: Overloaded"
}
```

### summarization_retry_scheduled / summarization_retry_attempt_start / summarization_retry_finished

当因临时性提供方错误而重试压缩操作或分支摘要（branch-summary）生成时发出。这些事件所使用的重试配置与自动助理回合（assistant-turn）重试配置相同。

```json
{
  "type": "summarization_retry_scheduled",
  "attempt": 1,
  "maxAttempts": 3,
  "delayMs": 2000,
  "errorMessage": "terminated"
}
```

```json
{
  "type": "summarization_retry_attempt_start",
  "source": "compaction",
  "reason": "threshold"
}
```

对于分支摘要，`source` 字段值为 `"branchSummary"`，且不包含 `reason` 字段。

```json
{
  "type": "summarization_retry_finished"
}
```

### extension_error

当扩展抛出错误时发出。

```json
{
  "type": "extension_error",
  "extensionPath": "/path/to/extension.ts",
  "event": "tool_call",
  "error": "Error message..."
}
```

## 扩展 UI 协议

扩展可通过 `ctx.ui.select()`、`ctx.ui.confirm()` 等方法请求用户交互。在 RPC 模式下，这些调用会被转换为一种构建于基础命令/事件流之上的请求-响应子协议。

扩展 UI 方法分为两类：

- **对话框方法**（`select`、`confirm`、`input`、`editor`）：向标准输出（stdout）发送一条 `extension_ui_request` 事件，并阻塞等待客户端通过标准输入（stdin）返回一条匹配 `id` 的 `extension_ui_response` 响应。
- **即发即弃方法**（`notify`、`setStatus`、`setWidget`、`setTitle`、`set_editor_text`）：向标准输出（stdout）发送一条 `extension_ui_request` 事件，但不期望收到任何响应。客户端可选择显示该信息，也可忽略。

若某对话框方法包含 `timeout` 字段，则代理端将在超时后自动以默认值完成解析；客户端无需自行跟踪超时。

部分 `ExtensionUIContext` 方法在 RPC 模式下不受支持或功能降级，因其需直接访问终端用户界面（TUI）：
- `custom()` 返回 `undefined`
- `setWorkingMessage()`、`setWorkingIndicator()`、`setFooter()`、`setHeader()`、`setEditorComponent()`、`setToolsExpanded()` 为无操作（no-op）
- `getEditorText()` 返回 `""`
- `getToolsExpanded()` 返回 `false`
- `pasteToEditor()` 委托给 `setEditorText()` 实现（不处理粘贴/折叠逻辑）
- `getAllThemes()` 返回 `[]`
- `getTheme()` 返回 `undefined`
- `setTheme()` 返回 `{ success: false, error: "..." }`

注意：在 RPC 模式下，`ctx.mode` 为 `"rpc"`，且 `ctx.hasUI` 为 `true`，这是因为对话框方法和即发即弃方法可通过扩展 UI 子协议正常工作。如需保护依赖真实终端的 TUI 特性（例如 `custom()`），请使用 `ctx.mode === "tui"` 进行判断。

### 扩展 UI 请求（标准输出，stdout）

所有请求均具有 `type: "extension_ui_request"` 字段、唯一 `id` 字段以及 `method` 字段。

#### select

提示用户从列表中进行选择。带 `timeout` 字段的对话框方法会将超时时间（单位：毫秒）一并发送；若客户端未在超时时间内响应，代理将自动以 `undefined` 值完成解析。

```json
{
  "type": "extension_ui_request",
  "id": "uuid-1",
  "method": "select",
  "title": "Allow dangerous command?",
  "options": ["Allow", "Block"],
  "timeout": 10000
}
```

预期响应：`extension_ui_response`，其中包含 `value` 字段（所选选项的字符串）或 `cancelled: true`。

#### confirm

提示用户进行“是/否”确认。

```json
{
  "type": "extension_ui_request",
  "id": "uuid-2",
  "method": "confirm",
  "title": "Clear session?",
  "message": "All messages will be lost.",
  "timeout": 5000
}
```

预期响应：`extension_ui_response`，其中包含 `confirmed: true/false` 或 `cancelled: true`。

#### input

提示用户输入自由格式文本。

```json
{
  "type": "extension_ui_request",
  "id": "uuid-3",
  "method": "input",
  "title": "Enter a value",
  "placeholder": "type something..."
}
```

预期响应：`extension_ui_response`，其中包含 `value` 字段（输入的文本）或 `cancelled: true`。

#### editor

打开一个多行文本编辑器，可选地预填充初始内容。

```json
{
  "type": "extension_ui_request",
  "id": "uuid-4",
  "method": "editor",
  "title": "Edit some text",
  "prefill": "Line 1\nLine 2\nLine 3"
}
```

预期响应：`extension_ui_response`，其中包含 `value` 字段（编辑后的文本）或 `cancelled: true`。

#### notify

显示一条通知。即发即弃，无需响应。

```json
{
  "type": "extension_ui_request",
  "id": "uuid-5",
  "method": "notify",
  "message": "Command blocked by user",
  "notifyType": "warning"
}
```

`notifyType` 字段取值为 `"info"`、`"warning"` 或 `"error"`；若省略该字段，则默认为 `"info"`。

#### setStatus

在页脚/状态栏中设置或清除一项状态条目。即发即弃。

```json
{
  "type": "extension_ui_request",
  "id": "uuid-6",
  "method": "setStatus",
  "statusKey": "my-ext",
  "statusText": "Turn 3 running..."
}
```

发送 `statusText: undefined`（或直接省略该字段）即可清除对应键（key）的状态条目。

#### setWidget

在编辑器上方或下方设置或清除一个部件（widget，即一组文本行）。即发即弃。

```json
{
  "type": "extension_ui_request",
  "id": "uuid-7",
  "method": "setWidget",
  "widgetKey": "my-ext",
  "widgetLines": ["--- My Widget ---", "Line 1", "Line 2"],
  "widgetPlacement": "aboveEditor"
}
```

发送 `widgetLines: undefined`（或直接省略该字段）即可清除该部件。`widgetPlacement` 字段取值为 `"aboveEditor"`（默认值）或 `"belowEditor"`。RPC 模式下仅支持字符串数组；组件工厂（component factories）将被忽略。

#### setTitle

设置终端窗口/标签页标题。即发即弃。

```json
{
  "type": "extension_ui_request",
  "id": "uuid-8",
  "method": "setTitle",
  "title": "pi - my project"
}
```

#### set_editor_text

设置输入编辑器中的文本。即发即弃。

```json
{
  "type": "extension_ui_request",
  "id": "uuid-9",
  "method": "set_editor_text",
  "text": "prefilled text for the user"
}
```

### 扩展 UI 响应（标准输入）

仅针对对话方法（`select`、`confirm`、`input`、`editor`）发送响应。其中 `id` 字段必须与对应请求的 `id` 一致。

#### 值响应（`select`、`input`、`editor`）

```json
{"type": "extension_ui_response", "id": "uuid-1", "value": "Allow"}
```

#### 确认响应（`confirm`）

```json
{"type": "extension_ui_response", "id": "uuid-2", "confirmed": true}
```

#### 取消响应（任意对话方法）

关闭任意对话方法。扩展将收到 `undefined`（对 `select`/`input`/`editor`）或 `false`（对 `confirm`）。

```json
{"type": "extension_ui_response", "id": "uuid-3", "cancelled": true}
```

## 错误处理

执行失败的命令将返回一个 `success: false` 的响应：

```json
{
  "type": "response",
  "command": "set_model",
  "success": false,
  "error": "Model not found: invalid/model"
}
```

解析错误：

```json
{
  "type": "response",
  "command": "parse",
  "success": false,
  "error": "Failed to parse command: Unexpected token..."
}
```

## 类型定义

源代码文件：
- [`packages/ai/src/types.ts`](../../ai/src/types.ts) —— `Model`、`UserMessage`、`AssistantMessage`、`ToolResultMessage`
- [`packages/agent/src/types.ts`](../../agent/src/types.ts) —— `AgentMessage`、`AgentEvent`
- [`src/core/messages.ts`](../src/core/messages.ts) —— `BashExecutionMessage`
- [`src/modes/json-event.ts`](../src/modes/json-event.ts) —— `JsonAgentSessionEvent`
- [`src/modes/rpc/rpc-types.ts`](../src/modes/rpc/rpc-types.ts) —— RPC 命令/响应类型、扩展 UI 请求/响应类型

### Model

```json
{
  "id": "claude-sonnet-4-20250514",
  "name": "Claude Sonnet 4",
  "api": "anthropic-messages",
  "provider": "anthropic",
  "baseUrl": "https://api.anthropic.com",
  "reasoning": true,
  "input": ["text", "image"],
  "contextWindow": 200000,
  "maxTokens": 16384,
  "cost": {
    "input": 3.0,
    "output": 15.0,
    "cacheRead": 0.3,
    "cacheWrite": 3.75
  }
}
```

### UserMessage

```json
{
  "role": "user",
  "content": "Hello!",
  "timestamp": 1733234567890,
  "attachments": []
}
```

`content` 字段可以是字符串，也可以是 `TextContent`/`ImageContent` 块组成的数组。

### AssistantMessage

```json
{
  "role": "assistant",
  "content": [
    {"type": "text", "text": "Hello! How can I help?"},
    {"type": "thinking", "thinking": "User is greeting me..."},
    {"type": "toolCall", "id": "call_123", "name": "bash", "arguments": {"command": "ls"}}
  ],
  "api": "anthropic-messages",
  "provider": "anthropic",
  "model": "claude-sonnet-4-20250514",
  "usage": {
    "input": 100,
    "output": 50,
    "cacheRead": 0,
    "cacheWrite": 0,
    "cost": {"input": 0.0003, "output": 0.00075, "cacheRead": 0, "cacheWrite": 0, "total": 0.00105}
  },
  "stopReason": "stop",
  "timestamp": 1733234567890
}
```

停止原因：`"stop"`、`"length"`、`"toolUse"`、`"error"`、`"aborted"`

### ToolResultMessage

```json
{
  "role": "toolResult",
  "toolCallId": "call_123",
  "toolName": "bash",
  "content": [{"type": "text", "text": "total 48\ndrwxr-xr-x ..."}],
  "usage": {
    "input": 100,
    "output": 50,
    "cacheRead": 0,
    "cacheWrite": 0,
    "totalTokens": 150,
    "cost": {"input": 0.0003, "output": 0.00075, "cacheRead": 0, "cacheWrite": 0, "total": 0.00105}
  },
  "isError": false,
  "timestamp": 1733234567890
}
```

`usage` 字段为可选字段，用于报告工具内部调用的嵌套 LLM 工作量。若存在该字段，则会累加至会话总 token 数及总成本中。

### BashExecutionMessage

由 `bash` RPC 命令创建（而非由 LLM 工具调用创建）：

```json
{
  "role": "bashExecution",
  "command": "ls -la",
  "output": "total 48\ndrwxr-xr-x ...",
  "exitCode": 0,
  "cancelled": false,
  "truncated": false,
  "fullOutputPath": null,
  "timestamp": 1733234567890
}
```

### Attachment

```json
{
  "id": "img1",
  "type": "image",
  "fileName": "photo.jpg",
  "mimeType": "image/jpeg",
  "size": 102400,
  "content": "base64-encoded-data...",
  "extractedText": null,
  "preview": null
}
```

## 示例：基础客户端（Python）

```python
import subprocess
import json

proc = subprocess.Popen(
    ["pi", "--mode", "rpc", "--no-session"],
    stdin=subprocess.PIPE,
    stdout=subprocess.PIPE,
    text=True
)

def send(cmd):
    proc.stdin.write(json.dumps(cmd) + "\n")
    proc.stdin.flush()

def read_events():
    for line in proc.stdout:
        yield json.loads(line)

# Send prompt
send({"type": "prompt", "message": "Hello!"})

# Process events
for event in read_events():
    if event.get("type") == "message_update":
        delta = event.get("assistantMessageEvent", {})
        if delta.get("type") == "text_delta":
            print(delta["delta"], end="", flush=True)
    
    if event.get("type") == "agent_end":
        print()
        break
```

## 示例：交互式客户端（Node.js）

完整交互式示例请参阅 [`test/rpc-example.ts`](../test/rpc-example.ts)，类型安全的客户端实现请参阅 [`src/modes/rpc/rpc-client.ts`](../src/modes/rpc/rpc-client.ts)。

如需查看完整扩展 UI 协议处理示例，请参阅 [`examples/rpc-extension-ui.ts`](../examples/rpc-extension-ui.ts)，该文件与扩展 [`examples/extensions/rpc-demo.ts`](../examples/extensions/rpc-demo.ts) 配套使用。

```javascript
const { spawn } = require("child_process");
const { StringDecoder } = require("string_decoder");

const agent = spawn("pi", ["--mode", "rpc", "--no-session"]);

function attachJsonlReader(stream, onLine) {
    const decoder = new StringDecoder("utf8");
    let buffer = "";

    stream.on("data", (chunk) => {
        buffer += typeof chunk === "string" ? chunk : decoder.write(chunk);

        while (true) {
            const newlineIndex = buffer.indexOf("\n");
            if (newlineIndex === -1) break;

            let line = buffer.slice(0, newlineIndex);
            buffer = buffer.slice(newlineIndex + 1);
            if (line.endsWith("\r")) line = line.slice(0, -1);
            onLine(line);
        }
    });

    stream.on("end", () => {
        buffer += decoder.end();
        if (buffer.length > 0) {
            onLine(buffer.endsWith("\r") ? buffer.slice(0, -1) : buffer);
        }
    });
}

attachJsonlReader(agent.stdout, (line) => {
    const event = JSON.parse(line);

    if (event.type === "message_update") {
        const { assistantMessageEvent } = event;
        if (assistantMessageEvent.type === "text_delta") {
            process.stdout.write(assistantMessageEvent.delta);
        }
    }
});

// Send prompt
agent.stdin.write(JSON.stringify({ type: "prompt", message: "Hello" }) + "\n");

// Abort on Ctrl+C
process.on("SIGINT", () => {
    agent.stdin.write(JSON.stringify({ type: "abort" }) + "\n");
});
```
