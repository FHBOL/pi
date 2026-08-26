# 工具系统

本文描述 Coding Agent 中工具的类型关系、内置工具构造方法、Extension 加载流程，以及模型调用工具的执行流程。

## 核心类型类图

```mermaid
classDiagram
    direction LR

    class Tool {
        +string name
        +string description
        +TSchema parameters
    }

    class AgentTool {
        +string label
        +prepareArguments(args)
        +execute(toolCallId, params, signal, onUpdate)
        +ToolExecutionMode executionMode
    }

    class ToolDefinition {
        +string name
        +string label
        +string description
        +TSchema parameters
        +string promptSnippet
        +string[] promptGuidelines
        +prepareArguments(args)
        +execute(toolCallId, params, signal, onUpdate, ctx)
        +renderCall(args, theme, context)
        +renderResult(result, options, theme, context)
    }

    class RegisteredTool {
        +ToolDefinition definition
        +SourceInfo sourceInfo
    }

    class Extension {
        +string path
        +string resolvedPath
        +Map tools
    }

    class ExtensionAPI {
        +registerTool(definition)
        +getActiveTools()
        +getAllTools()
        +setActiveTools(names)
    }

    class ExtensionRunner {
        +bindCore(actions, contextActions)
        +getAllRegisteredTools()
        +getToolDefinition(name)
        +createContext()
        +getActiveTools()
    }

    class AgentSession {
        -Map baseToolDefinitions
        -Map toolDefinitions
        -Map toolRegistry
        -ToolDefinition[] customTools
        +getAllTools()
        +getToolDefinition(name)
        +getActiveToolNames()
        +setActiveToolsByName(names)
        -refreshToolRegistry(options)
        -buildRuntime(options)
    }

    class ExtensionContext {
        +string cwd
        +Model model
        +SessionManager sessionManager
        +ExtensionUIContext ui
    }

    Tool <|-- AgentTool
    RegisteredTool *-- ToolDefinition : definition
    Extension *-- RegisteredTool : tools
    ExtensionAPI ..> ToolDefinition : registerTool
    ExtensionRunner o-- Extension : loaded extensions
    ExtensionRunner ..> ExtensionContext : creates
    AgentSession *-- ExtensionRunner
    AgentSession o-- ToolDefinition : definitions
    AgentSession o-- AgentTool : active registry
    ToolDefinition ..> AgentTool : wrapped into
    ToolDefinition ..> ExtensionContext : execute receives
```

`ToolDefinition` 是 Coding Agent 层使用的完整定义，包含系统提示词贡献和 TUI 渲染方法。`AgentTool` 是 `pi-agent-core` 执行循环所需的较小接口。`wrapToolDefinition()` 负责在二者之间转换。

## Bash 工具相关方法

```mermaid
classDiagram
    direction TB

    class BashToolOptions {
        +BashOperations operations
        +string commandPrefix
        +string shellPath
        +boolean exposeSessionEnvironment
        +BashSpawnHook spawnHook
    }

    class BashOperations {
        +exec(command, cwd, options)
    }

    class BashSpawnContext {
        +string command
        +string cwd
        +ProcessEnv env
    }

    class BashToolDefinition {
        +string name = bash
        +execute(toolCallId, params, signal, onUpdate, ctx)
        +renderCall(args, theme, context)
        +renderResult(result, options, theme, context)
    }

    class BashFactory {
        +createLocalBashOperations(options)
        +createBashToolDefinition(cwd, options)
        +createBashTool(cwd, options)
        -resolveSpawnContext(command, cwd, hook, expose, ctx)
        -resolveTimeoutMs(timeout)
    }

    BashToolOptions o-- BashOperations
    BashToolOptions ..> BashSpawnContext : spawnHook
    BashFactory ..> BashOperations : default backend
    BashFactory ..> BashSpawnContext : resolves
    BashFactory ..> BashToolDefinition : creates
    BashToolDefinition --|> ToolDefinition
    BashFactory ..> AgentTool : createBashTool wraps
```

内置 Bash 工具的构造分为两层：

```text
createBashToolDefinition(cwd, options)
  -> ToolDefinition
  -> wrapToolDefinition(definition)
  -> AgentTool
```

Extension 通常只需要调用 `pi.registerTool(definition)`，不需要自行调用 `wrapToolDefinition()`。

## 工具加载与注册流程

```mermaid
flowchart TD
    A[ResourceLoader.reload] --> B[PackageManager 解析 Extension 来源]
    B --> C[loadExtensionsCached]
    C --> D[loadExtensionModule]
    D --> E[jiti 导入 TypeScript 或 JavaScript 模块]
    E --> F[createExtension]
    F --> G[createExtensionAPI]
    G --> H[执行 extension factory]
    H --> I[pi.registerTool definition]
    I --> J[extension.tools.set name RegisteredTool]
    J --> K{ExtensionRuntime 已绑定?}
    K -- 初次加载: 否 --> L[refreshTools 暂为空操作]
    K -- 启动后动态注册: 是 --> M[AgentSession.refreshToolRegistry]

    L --> N[AgentSession.buildRuntime]
    N --> O[createAllToolDefinitions 创建内置定义]
    N --> P[从 ResourceLoader 取得 Extensions]
    P --> Q[创建 ExtensionRunner]
    Q --> R[bindCore 绑定 refreshTools 等运行时动作]
    R --> M
    O --> M

    M --> S[ExtensionRunner.getAllRegisteredTools]
    S --> T[合并 Extension 与 SDK customTools]
    T --> U[建立 ToolDefinition Registry]
    U --> V[wrapRegisteredTools]
    V --> W[建立 AgentTool Registry]
    W --> X[setActiveToolsByName]
    X --> Y[agent.state.tools = active AgentTools]
    X --> Z[重建 system prompt]
```

名称冲突的处理顺序如下：

1. `ExtensionRunner.getAllRegisteredTools()` 遍历 Extension；Extension 之间同名时，先加载者胜出。
2. `AgentSession` 先放入内置定义，再放入 Extension 和 SDK 自定义定义，因此自定义工具可覆盖同名内置工具。
3. `AgentTool` Registry 同样先放内置工具，再放自定义工具，因此最终执行实现与定义 Registry 保持一致。

## 模型调用工具的执行时序

```mermaid
sequenceDiagram
    autonumber
    participant Model as 模型
    participant Loop as Agent Loop
    participant Session as AgentSession
    participant Tool as AgentTool Wrapper
    participant Runner as ExtensionRunner
    participant Definition as ToolDefinition

    Session->>Loop: 提供 systemPrompt 和 active tools
    Loop->>Model: 请求响应并携带工具 schema
    Model-->>Loop: toolCall(name, id, arguments)
    Loop->>Loop: 按 executionMode 选择串行或并行
    Loop->>Loop: 按 name 查找 active AgentTool
    Loop->>Loop: prepareArguments 并验证 TypeBox schema
    Loop->>Session: beforeToolCall hook
    Session-->>Loop: allow 或 block

    alt 允许执行
        Loop->>Tool: execute(id, params, signal, onUpdate)
        Tool->>Runner: createContext()
        Runner-->>Tool: ExtensionContext
        Tool->>Definition: execute(id, params, signal, onUpdate, ctx)
        loop 流式进度
            Definition-->>Loop: onUpdate(partialResult)
            Loop-->>Session: tool_execution_update
        end
        Definition-->>Tool: AgentToolResult
        Tool-->>Loop: AgentToolResult
        Loop->>Session: afterToolCall hook
    else 被阻止或参数无效
        Loop->>Loop: 创建错误 ToolResult
    end

    Loop-->>Session: tool_execution_end
    Loop->>Loop: 转换为 ToolResultMessage
    Loop->>Model: 下一轮上下文包含工具结果
```

## 关键源码

- `src/core/extensions/types.ts`：`ToolDefinition`、`RegisteredTool`、`Extension` 和 `ExtensionAPI`。
- `src/core/extensions/loader.ts`：Extension 模块加载、`createExtensionAPI()` 和 `registerTool()`。
- `src/core/extensions/runner.ts`：工具收集、运行时绑定和 `ExtensionContext` 创建。
- `src/core/extensions/wrapper.ts`：`RegisteredTool` 到 `AgentTool` 的包装。
- `src/core/tools/tool-definition-wrapper.ts`：`ToolDefinition` 到 `AgentTool` 的基础适配。
- `src/core/tools/bash.ts`：Bash 定义、执行后端、流式输出和渲染。
- `src/core/agent-session.ts`：Definition Registry、AgentTool Registry 和 active tools。
- `packages/agent/src/agent-loop.ts`：参数验证、串并行策略和工具执行。
