# 子代理示例

将任务委托给具有隔离上下文窗口的专用子代理。

## 功能

- **隔离上下文**：每个子代理在独立的 `pi` 进程中运行
- **流式输出**：实时查看工具调用与进度
- **并行流式**：所有并行任务同时流式更新
- **Markdown 渲染**：最终输出以正确格式渲染（展开视图）
- **用量跟踪**：显示每个代理的回合数、token、费用与上下文用量
- **中止支持**：Ctrl+C 会传播并终止子代理进程

## 结构

```
subagent/
├── README.md            # This file
├── index.ts             # The extension (entry point)
├── agents.ts            # Agent discovery logic
├── agents/              # Sample agent definitions
│   ├── scout.md         # Fast recon, returns compressed context
│   ├── planner.md       # Creates implementation plans
│   ├── reviewer.md      # Code review
│   └── worker.md        # General-purpose (full capabilities)
└── prompts/             # Workflow presets (prompt templates)
    ├── implement.md     # scout -> planner -> worker
    ├── scout-and-plan.md    # scout -> planner (no implementation)
    └── implement-and-review.md  # worker -> reviewer -> worker
```

## 安装

从仓库根目录创建符号链接：

```bash
# Symlink the extension (must be in a subdirectory with index.ts)
mkdir -p ~/.pi/agent/extensions/subagent
ln -sf "$(pwd)/packages/coding-agent/examples/extensions/subagent/index.ts" ~/.pi/agent/extensions/subagent/index.ts
ln -sf "$(pwd)/packages/coding-agent/examples/extensions/subagent/agents.ts" ~/.pi/agent/extensions/subagent/agents.ts

# Symlink agents
mkdir -p ~/.pi/agent/agents
for f in packages/coding-agent/examples/extensions/subagent/agents/*.md; do
  ln -sf "$(pwd)/$f" ~/.pi/agent/agents/$(basename "$f")
done

# Symlink workflow prompts
mkdir -p ~/.pi/agent/prompts
for f in packages/coding-agent/examples/extensions/subagent/prompts/*.md; do
  ln -sf "$(pwd)/$f" ~/.pi/agent/prompts/$(basename "$f")
done
```

## 安全模型

此工具会以委托的系统提示词与工具/模型配置执行独立的 `pi` 子进程。

**项目本地 agents**（`.pi/agents/*.md`）是仓库控制的提示词，可指示模型读取文件、运行 bash 命令等。

**默认行为：** 仅从 `~/.pi/agent/agents` 加载**用户级 agents**。

要启用项目本地 agents，传入 `agentScope: "both"`（或 `"project"`）。仅对你信任的仓库这样做。

交互运行时，工具在运行项目本地 agents 前会请求确认。设置 `confirmProjectAgents: false` 可禁用。

## 用法

### 单个代理
```
Use scout to find all authentication code
```

### 并行执行
```
Run 2 scouts in parallel: one to find models, one to find providers
```

### 链式工作流
```
Use a chain: first have scout find the read tool, then have planner suggest improvements
```

### 工作流提示词
```
/implement add Redis caching to the session store
/scout-and-plan refactor auth to support OAuth
/implement-and-review add input validation to API endpoints
```

## 工具模式

| 模式 | 参数 | 说明 |
|------|------|------|
| 单个 | `{ agent, task }` | 一个代理，一个任务 |
| 并行 | `{ tasks: [...] }` | 多个代理并发运行（最多 8 个，4 个并发） |
| 链式 | `{ chain: [...] }` | 顺序执行，支持 `{previous}` 占位符 |

## 输出显示

**折叠视图**（默认）：
- 状态图标（✓/✗/⏳）与代理名称
- 最近 5–10 项（工具调用与文本）
- 用量统计：`3 turns ↑input ↓output RcacheRead WcacheWrite $cost ctx:contextTokens model`

**展开视图**（Ctrl+O）：
- 完整任务文本
- 所有工具调用及格式化参数
- 最终输出以 Markdown 渲染
- 每任务用量（链式/并行）

**并行模式流式**：
- 显示所有任务及实时状态（⏳ 运行中、✓ 完成、✗ 失败）
- 随每个任务进展更新
- 显示「2/3 done, 1 running」状态
- 将每个已完成任务的最终输出返回给父模型，每个任务上限 50 KB
- 当子进程在产生输出前退出时，从 stderr/错误消息返回失败诊断信息

**工具调用格式**（模仿内置工具）：
- bash：`$ command`
- read：`read ~/path:1-10`
- grep：`grep /pattern/ in ~/path`
- 等等

## Agent 定义

Agents 是带 YAML frontmatter 的 markdown 文件：

```markdown
---
name: my-agent
description: What this agent does
tools: read, grep, find, ls
model: claude-haiku-4-5
---

System prompt for the agent goes here.
```

**位置：**
- `~/.pi/agent/agents/*.md` - 用户级（始终加载）
- `.pi/agents/*.md` - 项目级（仅在 `agentScope: "project"` 或 `"both"` 时）

当 `agentScope: "both"` 时，同名的项目 agents 会覆盖用户 agents。

## 示例 Agents

| Agent | 用途 | 模型 | 工具 |
|-------|------|------|------|
| `scout` | 快速代码库侦察 | Haiku | read, grep, find, ls, bash |
| `planner` | 实现计划 | Sonnet | read, grep, find, ls |
| `reviewer` | 代码审查 | Sonnet | read, grep, find, ls, bash |
| `worker` | 通用 | Sonnet | （全部默认） |

## 工作流提示词

| 提示词 | 流程 |
|--------|------|
| `/implement <query>` | scout → planner → worker |
| `/scout-and-plan <query>` | scout → planner |
| `/implement-and-review <query>` | worker → reviewer → worker |

## 错误处理

- **退出码 != 0**：工具返回带 stderr/输出的错误
- **stopReason "error"**：传播 LLM 错误及错误消息
- **stopReason "aborted"**：用户中止（Ctrl+C）会终止子进程并抛出错误
- **链式模式**：在第一个失败步骤停止，并报告失败步骤

## 限制

- 折叠视图中输出截断为最近 10 项（展开可查看全部）
- 并行模式下对模型可见的输出每任务上限 50 KB；完整结果保留在工具 details 中
- 每次调用都会重新发现 agents（允许在会话中途编辑）
- 并行模式限制为 8 个任务、4 个并发
