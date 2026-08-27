# Agent Loop

`runLoop`（`packages/agent/src/agent-loop.ts`）是一次 agent 运行的调度器：调模型 → 执行工具 → 插入用户消息 → 再调模型，直到没有下一拍。`agentLoop`（新 prompt）和 `agentLoopContinue`（从已有上下文续跑）共用它。

循环自己用局部状态推进。`emit` 只是把同一条时间线推给观察者，不参与下一拍决策。

## 两层循环

- **内层**：还有工具结果要回填，或有 steering 要插入，就再开一轮。
- **外层**：内层本来要停了，再看 follow-up。有就把 follow-up 当成 pending 重新进内层；没有就结束。

Steering 和 follow-up 时机不同：

| | 何时注入 | 典型用途 |
|---|---|---|
| **steering** | 当前 assistant 轮次（含工具）结束后、下一次 LLM 调用前 | 用户在 agent 干活时插话 |
| **follow-up** | 没有工具、也没有 steering，agent 本来要停的时候 | 等当前任务做完再跑下一条 |

一轮 turn：注入 pending → 流式调模型 →（可选）执行工具 → `turn_end` → `prepareNextTurn` / `shouldStopAfterTurn` → 拉 steering。

退出条件：模型 `error`/`aborted`；`shouldStopAfterTurn` 为 true（不再拉队列）；没有工具、steering、follow-up。

`stopReason === "length"` 时工具参数可能被截断，全部标失败，不执行。整批工具都带 `terminate: true` 时，内层不再为工具续跑。

```mermaid
flowchart TD
  start[进入 runLoop] --> inner{还有工具或 pending?}
  inner -->|是| turn[注入 pending → LLM → 工具]
  turn --> stop{error / aborted / shouldStop?}
  stop -->|是| end[agent_end]
  stop -->|否| steer[拉 steering] --> inner
  inner -->|否| follow{有 follow-up?}
  follow -->|有| inner
  follow -->|无| end
```

两份消息列表：`currentContext.messages` 是完整对话，下一轮 LLM 看到它；`newMessages` 是这次调用的增量，随 `agent_end` 发出。prompt 跑会带上初始 prompt；continue 跑从空数组开始。

## 事件

事件不驱动循环。类型注释写的是给 UI 和上层用。经过两层再分发：

```text
runLoop.emit(AgentEvent)
  → Agent.processEvents        先 reduce 成 Agent.state，再 notify
  → AgentSession._handleAgentEvent
       扩展 / 落盘 / 队列 / retry
       再转成 AgentSessionEvent
         → 交互 TUI / print --json / RPC / SDK subscribe
```

粒度：

- **生命周期**：`agent_*`、`turn_*` — 一次 run / 一轮「模型 + 工具」的边界
- **消息**：`message_start` / `message_update` / `message_end` — transcript 增量；`update` 只在 assistant 流式时出现
- **工具**：`tool_execution_*` — 执行进度；和 transcript 里的 `toolResult` 消息是两条线

`Agent.processEvents` 维护可查询状态：`streamingMessage`、`state.messages`、`pendingToolCalls`、`errorMessage`。`AgentSession` 在 `message_end` 落盘，在 user `message_start` 时从 steering/follow-up 队列摘掉对应文本。交互 TUI 用事件刷新 chat / 工具块 / Working 指示器；print `--json` 和 RPC 几乎原样序列化 `AgentSessionEvent`。

没有事件循环仍能跑完；没有事件 TUI / JSON / 扩展就看不到中间过程。

## `streamingMessage`

`Agent.state.streamingMessage` 是 assistant 流式过程中的半成品快照。`state.messages` 只在 `message_end` 才追加完整消息。

`streamAssistantResponse` 把 LLM token 流映射成：`start` → `message_start`；每个 `text_delta` / `thinking_delta` / `toolcall_delta` → `message_update`；`done`/`error` → `message_end`。中间的 `message_update` 可持续数秒，不是「update 完立刻 end」。

user / toolResult / steering 是连续 `message_start` + `message_end`，没有 `update`，此时 `streamingMessage` 几乎看不见。

coding-agent 的 TUI 不读 `agent.state.streamingMessage`，自己从事件抄一份刷新组件。这个字段是给只轮询 `agent.state`、不订阅事件的调用方用的。

## `agent_end` 的 `newMessages`

`emit({ type: "agent_end", messages: newMessages })` 带的是这次 run 的增量，不是完整 transcript。`Agent` 走 `runAgentLoop` 时丢掉返回值；公开历史已经在每条 `message_end` 推进 `state.messages`。

coding-agent 里读这个数组的地方：

1. **自动重试**：`AgentSession._willRetryAfterAgentEnd` 倒着找本轮最后一条 assistant，判断是不是可重试错误，给下游补 `willRetry`。用增量是为了不被历史里更早的 assistant 干扰。
2. **扩展**：原样转发给 `pi.on("agent_end")`。例如 plan-mode 用本轮最后一条 assistant 抽 todo。扩展在这里 `sendMessage` 排队的内容，要等这次结束后再开 continuation。
3. **JSON / RPC**：`toJsonEvent` 不裁剪 `agent_end`，`messages` 进 stdout，客户端不必自己从 `message_end` 拼本轮新消息。

交互 TUI 的 `agent_end` 只关 progress、清 streaming 组件，不读 `event.messages`。低层 `agentLoop()` 会把这份数组当作 `EventStream.result()`，coding-agent 不走那条 API。
