# 压缩与分支汇总

LLM 的上下文窗口有限。当对话过长时，pi 使用压缩汇总较早内容，同时保留近期工作。本页涵盖自动压缩与分支汇总。

**源文件**（[pi-mono](https://github.com/earendil-works/pi-mono)）：
- [`packages/coding-agent/src/core/compaction/compaction.ts`](https://github.com/earendil-works/pi-mono/blob/main/packages/coding-agent/src/core/compaction/compaction.ts) - 自动压缩逻辑
- [`packages/coding-agent/src/core/compaction/branch-summarization.ts`](https://github.com/earendil-works/pi-mono/blob/main/packages/coding-agent/src/core/compaction/branch-summarization.ts) - 分支汇总
- [`packages/coding-agent/src/core/compaction/utils.ts`](https://github.com/earendil-works/pi-mono/blob/main/packages/coding-agent/src/core/compaction/utils.ts) - 共享工具（文件跟踪、序列化）
- [`packages/coding-agent/src/core/session-manager.ts`](https://github.com/earendil-works/pi-mono/blob/main/packages/coding-agent/src/core/session-manager.ts) - 条目类型（`CompactionEntry`、`BranchSummaryEntry`）
- [`packages/coding-agent/src/core/extensions/types.ts`](https://github.com/earendil-works/pi-mono/blob/main/packages/coding-agent/src/core/extensions/types.ts) - 扩展事件类型

项目中的 TypeScript 定义可查看 `node_modules/@earendil-works/pi-coding-agent/dist/`。

## 概述

Pi 有两种汇总机制：

| 机制 | 触发 | 目的 |
|-----------|---------|---------|
| 压缩 | 上下文超过阈值，或 `/compact` | 汇总旧消息以释放上下文 |
| 分支汇总 | `/tree` 导航 | 切换分支时保留上下文 |

两者使用相同的结构化摘要格式，并累积跟踪文件操作。压缩与分支摘要请求使用新的路由会话 ID，并在提供商支持时禁用 prompt-cache 写入，因为这些一次性提示不太可能被复用。

## 压缩

### 何时触发

自动压缩在以下情况触发：

```
contextTokens > contextWindow - reserveTokens
```

默认情况下，`reserveTokens` 为 16384 tokens（可在 `~/.pi/agent/settings.json` 或 `<project-dir>/.pi/settings.json` 中配置）。这为 LLM 的响应留出空间。

你也可以用 `/compact [instructions]` 手动触发，可选说明用于聚焦摘要。

### 工作原理

1. **找到切割点**：从最新消息向后走，累积 token 估算，直到达到 `keepRecentTokens`（默认 20k，可在 `~/.pi/agent/settings.json` 或 `<project-dir>/.pi/settings.json` 中配置）
2. **提取消息**：收集从上一个保留边界（或会话开始）到切割点的消息
3. **生成摘要**：调用 LLM 以结构化格式汇总；若存在先前摘要则作为迭代上下文传入
4. **追加条目**：保存带摘要与 `firstKeptEntryId` 的 `CompactionEntry`
5. **重新加载**：会话重新加载，使用摘要 + 从 `firstKeptEntryId` 起的消息

```
Before compaction:

  entry:  0     1     2     3      4     5     6      7      8     9
        ┌─────┬─────┬─────┬─────┬──────┬─────┬─────┬──────┬──────┬─────┐
        │ hdr │ usr │ ass │ tool │ usr │ ass │ tool │ tool │ ass │ tool│
        └─────┴─────┴─────┴──────┴─────┴─────┴──────┴──────┴─────┴─────┘
                └────────┬───────┘ └──────────────┬──────────────┘
               messagesToSummarize            kept messages
                                   ↑
                          firstKeptEntryId (entry 4)

After compaction (new entry appended):

  entry:  0     1     2     3      4     5     6      7      8     9     10
        ┌─────┬─────┬─────┬─────┬──────┬─────┬─────┬──────┬──────┬─────┬─────┐
        │ hdr │ usr │ ass │ tool │ usr │ ass │ tool │ tool │ ass │ tool│ cmp │
        └─────┴─────┴─────┴──────┴─────┴─────┴──────┴──────┴─────┴─────┴─────┘
               └──────────┬──────┘ └──────────────────────┬───────────────────┘
                 not sent to LLM                    sent to LLM
                                                         ↑
                                              starts from firstKeptEntryId

What the LLM sees:

  ┌────────┬─────────┬─────┬─────┬──────┬──────┬─────┬──────┐
  │ system │ summary │ usr │ ass │ tool │ tool │ ass │ tool │
  └────────┴─────────┴─────┴─────┴──────┴──────┴─────┴──────┘
       ↑         ↑      └─────────────────┬────────────────┘
    prompt   from cmp          messages from firstKeptEntryId
```

在重复压缩时，被汇总的跨度从前一次压缩的保留边界（`firstKeptEntryId`）开始，而不是从压缩条目本身开始；若该保留条目在路径中找不到，则回退到前一次压缩之后的条目。这样会把在较早压缩中存活下来的消息也纳入下一次汇总。Pi 还会在写入新的 `CompactionEntry` 之前，从重建的会话上下文重新计算 `tokensBefore`，使 token 计数反映实际被替换的压缩前上下文。

### 分割轮次（Split Turns）

一个「轮次」从用户消息开始，包含所有助手响应与工具调用，直到下一条用户消息。通常，压缩在轮次边界切割。

当单个轮次超过 `keepRecentTokens` 时，切割点会落在轮次中间的助手消息上。这就是「分割轮次」：

```
Split turn (one huge turn exceeds budget):

  entry:  0     1     2      3     4      5      6     7      8
        ┌─────┬─────┬─────┬──────┬─────┬──────┬──────┬─────┬──────┐
        │ hdr │ usr │ ass │ tool │ ass │ tool │ tool │ ass │ tool │
        └─────┴─────┴─────┴──────┴─────┴──────┴──────┴─────┴──────┘
                ↑                                     ↑
         turnStartIndex = 1                  firstKeptEntryId = 7
                │                                     │
                └──── turnPrefixMessages (1-6) ───────┘
                                                      └── kept (7-8)

  isSplitTurn = true
  messagesToSummarize = []  (no complete turns before)
  turnPrefixMessages = [usr, ass, tool, ass, tool, tool]
```

对于分割轮次，pi 生成两份摘要并合并：
1. **历史摘要**：先前上下文（若有）
2. **轮次前缀摘要**：分割轮次的前半部分

### 切割点规则

有效切割点为：
- 用户消息
- 助手消息
- BashExecution 消息
- 自定义消息（custom_message、branch_summary）

永不在工具结果处切割（它们必须与对应的工具调用放在一起）。

### CompactionEntry 结构

定义于 [`session-manager.ts`](https://github.com/earendil-works/pi-mono/blob/main/packages/coding-agent/src/core/session-manager.ts)：

```typescript
interface CompactionEntry<T = unknown> {
  type: "compaction";
  id: string;
  parentId: string;
  timestamp: number;
  summary: string;
  firstKeptEntryId: string;
  tokensBefore: number;
  usage?: Usage;       // LLM usage that generated the summary
  fromHook?: boolean;  // true if provided by extension (legacy field name)
  details?: T;         // implementation-specific data
}

// Default compaction uses this for details (from compaction.ts):
interface CompactionDetails {
  readFiles: string[];
  modifiedFiles: string[];
}
```

扩展可在 `details` 中存储任何可 JSON 序列化的数据。默认压缩跟踪文件操作，但自定义扩展实现可使用自己的结构。生成的与扩展提供的摘要在可用时会存储其 LLM `usage`，以便会话总计包含汇总工作。

实现参见 [`prepareCompaction()`](https://github.com/earendil-works/pi-mono/blob/main/packages/coding-agent/src/core/compaction/compaction.ts) 与 [`compact()`](https://github.com/earendil-works/pi-mono/blob/main/packages/coding-agent/src/core/compaction/compaction.ts)。若要直接以编程方式汇总，`generateSummary()` 返回摘要文本，`generateSummaryWithUsage()` 返回 `{ text, usage }`。

## 分支汇总

### 何时触发

当你用 `/tree` 导航到不同分支时，pi 会提议汇总你正离开的工作。这会将被离开分支的上下文注入新分支。

### 工作原理

1. **找到共同祖先**：旧位置与新位置共享的最深节点
2. **收集条目**：从旧叶子走回共同祖先
3. **按预算准备**：按 token 预算包含消息（最新优先）
4. **生成摘要**：用结构化格式调用 LLM
5. **追加条目**：在导航点保存 `BranchSummaryEntry`

```
Tree before navigation:

         ┌─ B ─ C ─ D (old leaf, being abandoned)
    A ───┤
         └─ E ─ F (target)

Common ancestor: A
Entries to summarize: B, C, D

After navigation with summary:

         ┌─ B ─ C ─ D
    A ───┤
         └─ E ─ F ─ [summary of B,C,D] (new leaf)
```

### 累积文件跟踪

压缩与分支汇总都累积跟踪文件。生成摘要时，pi 从以下提取文件操作：
- 被汇总消息中的工具调用
- 先前压缩或分支摘要的 `details`（若有）

这意味着文件跟踪会跨多次压缩或嵌套分支摘要累积，保留已读与已修改文件的完整历史。

### BranchSummaryEntry 结构

定义于 [`session-manager.ts`](https://github.com/earendil-works/pi-mono/blob/main/packages/coding-agent/src/core/session-manager.ts)：

```typescript
interface BranchSummaryEntry<T = unknown> {
  type: "branch_summary";
  id: string;
  parentId: string;
  timestamp: number;
  summary: string;
  fromId: string;      // Entry we navigated from
  usage?: Usage;       // LLM usage that generated the summary
  fromHook?: boolean;  // true if provided by extension (legacy field name)
  details?: T;         // implementation-specific data
}

// Default branch summarization uses this for details (from branch-summarization.ts):
interface BranchSummaryDetails {
  readFiles: string[];
  modifiedFiles: string[];
}
```

与压缩相同，扩展可在 `details` 中存储自定义数据。

实现参见 [`collectEntriesForBranchSummary()`](https://github.com/earendil-works/pi-mono/blob/main/packages/coding-agent/src/core/compaction/branch-summarization.ts)、[`prepareBranchEntries()`](https://github.com/earendil-works/pi-mono/blob/main/packages/coding-agent/src/core/compaction/branch-summarization.ts) 与 [`generateBranchSummary()`](https://github.com/earendil-works/pi-mono/blob/main/packages/coding-agent/src/core/compaction/branch-summarization.ts)。

## 摘要格式

压缩与分支汇总使用相同的结构化格式：

```markdown
## Goal
[What the user is trying to accomplish]

## Constraints & Preferences
- [Requirements mentioned by user]

## Progress
### Done
- [x] [Completed tasks]

### In Progress
- [ ] [Current work]

### Blocked
- [Issues, if any]

## Key Decisions
- **[Decision]**: [Rationale]

## Next Steps
1. [What should happen next]

## Critical Context
- [Data needed to continue]

<read-files>
path/to/file1.ts
path/to/file2.ts
</read-files>

<modified-files>
path/to/changed.ts
</modified-files>
```

### 消息序列化

汇总前，消息通过 [`serializeConversation()`](https://github.com/earendil-works/pi-mono/blob/main/packages/coding-agent/src/core/compaction/utils.ts) 序列化为文本：

```
[User]: What they said
[Assistant thinking]: Internal reasoning
[Assistant]: Response text
[Assistant tool calls]: read(path="foo.ts"); edit(path="bar.ts", ...)
[Tool result]: Output from tool
```

这可防止模型将其当作要继续的对话。

序列化期间工具结果截断为 2000 字符。超出限制的内容替换为指示截断字符数的标记。这使汇总请求保持在合理的 token 预算内，因为工具结果（尤其来自 `read` 与 `bash`）通常是上下文大小的最大贡献者。

## 通过扩展自定义汇总

扩展可以拦截并自定义压缩与分支汇总。事件类型定义见 [`extensions/types.ts`](https://github.com/earendil-works/pi-mono/blob/main/packages/coding-agent/src/core/extensions/types.ts)。

### session_before_compact

在自动压缩或 `/compact` 之前触发。可以取消或提供自定义摘要。参见类型文件中的 `SessionBeforeCompactEvent` 与 `CompactionPreparation`。

```typescript
pi.on("session_before_compact", async (event, ctx) => {
  const { preparation, branchEntries, customInstructions, reason, willRetry, signal } = event;

  // preparation.messagesToSummarize - messages to summarize
  // preparation.turnPrefixMessages - split turn prefix (if isSplitTurn)
  // preparation.previousSummary - previous compaction summary
  // preparation.fileOps - extracted file operations
  // preparation.tokensBefore - context tokens before compaction
  // preparation.firstKeptEntryId - where kept messages start
  // preparation.settings - compaction settings

  // branchEntries - all entries on current branch (for custom state)
  // reason - "manual" (/compact), "threshold", or "overflow"
  // willRetry - whether the aborted turn is retried after compaction (overflow recovery)
  // signal - AbortSignal (pass to LLM calls)

  // Cancel:
  return { cancel: true };

  // Custom summary:
  return {
    compaction: {
      summary: "Your summary...",
      firstKeptEntryId: preparation.firstKeptEntryId,
      tokensBefore: preparation.tokensBefore,
      // usage: summaryResponse.usage, // Optional; included in session totals
      details: { /* custom data */ },
    }
  };
});
```

#### 将消息转换为文本

要用自己的模型生成摘要，使用 `serializeConversation` 将消息转换为文本：

```typescript
import { convertToLlm, serializeConversation } from "@earendil-works/pi-coding-agent";

pi.on("session_before_compact", async (event, ctx) => {
  const { preparation } = event;
  
  // Convert AgentMessage[] to Message[], then serialize to text
  const conversationText = serializeConversation(
    convertToLlm(preparation.messagesToSummarize)
  );
  // Returns:
  // [User]: message text
  // [Assistant thinking]: thinking content
  // [Assistant]: response text
  // [Assistant tool calls]: read(path="..."); bash(command="...")
  // [Tool result]: output text

  // Now send to your model for summarization
  const { summary, usage } = await myModel.summarize(conversationText);
  
  return {
    compaction: {
      summary,
      firstKeptEntryId: preparation.firstKeptEntryId,
      tokensBefore: preparation.tokensBefore,
      usage,
    }
  };
});
```

使用不同模型的完整示例见 [custom-compaction.ts](../examples/extensions/custom-compaction.ts)。

### session_before_tree

在 `/tree` 导航之前触发。无论用户是否选择汇总都会触发。可以取消导航或提供自定义摘要。

```typescript
pi.on("session_before_tree", async (event, ctx) => {
  const { preparation, signal } = event;

  // preparation.targetId - where we're navigating to
  // preparation.oldLeafId - current position (being abandoned)
  // preparation.commonAncestorId - shared ancestor
  // preparation.entriesToSummarize - entries that would be summarized
  // preparation.userWantsSummary - whether user chose to summarize

  // Cancel navigation entirely:
  return { cancel: true };

  // Provide custom summary (only used if userWantsSummary is true):
  if (preparation.userWantsSummary) {
    return {
      summary: {
        summary: "Your summary...",
        // usage: summaryResponse.usage, // Optional; included in session totals
        details: { /* custom data */ },
      }
    };
  }
});
```

参见类型文件中的 `SessionBeforeTreeEvent` 与 `TreePreparation`。

## 设置

在 `~/.pi/agent/settings.json` 或 `<project-dir>/.pi/settings.json` 中配置压缩：

```json
{
  "compaction": {
    "enabled": true,
    "reserveTokens": 16384,
    "keepRecentTokens": 20000
  }
}
```

| 设置 | 默认值 | 说明 |
|---------|---------|-------------|
| `enabled` | `true` | 启用自动压缩 |
| `reserveTokens` | `16384` | 为 LLM 响应预留的 tokens |
| `keepRecentTokens` | `20000` | 保留的近期 tokens（不汇总） |

用 `"enabled": false` 禁用自动压缩。你仍可用 `/compact` 手动压缩。
