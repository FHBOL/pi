# 自定义提供商

扩展可通过 `pi.registerProvider()` 注册自定义模型提供商。这支持：

- **代理** - 通过企业代理或 API 网关路由请求
- **自定义端点** - 使用自托管或私有模型部署
- **OAuth/SSO** - 为企业提供商添加认证流程
- **自定义 API** - 为非标准 LLM API 实现流式传输

## 示例扩展

参见这些完整的提供商示例：

- [`examples/extensions/custom-provider-anthropic/`](../examples/extensions/custom-provider-anthropic/)
- [`examples/extensions/custom-provider-gitlab-duo/`](../examples/extensions/custom-provider-gitlab-duo/)
- [`examples/extensions/custom-provider-zenmux/`](../examples/extensions/custom-provider-zenmux/) — OpenAI 兼容网关 + 远程模型发现（入门）

## 目录

- [示例扩展](#示例扩展)
- [快速参考](#快速参考)
- [覆盖现有提供商](#覆盖现有提供商)
- [注册新提供商](#注册新提供商)
- [注销提供商](#注销提供商)
- [OAuth 支持](#oauth-支持)
- [自定义流式 API](#自定义流式-api)
- [上下文溢出错误](#上下文溢出错误)
- [测试你的实现](#测试你的实现)
- [配置参考](#配置参考)
- [模型定义参考](#模型定义参考)

## 快速参考

扩展可以注册完整的 pi-ai `Provider`，或使用旧版提供商配置形式。当需要自定义认证、过滤、刷新或流式行为时，优先使用完整提供商。Pi 会在已注册的原生提供商之上组合 `models.json` 覆盖。

```typescript
import { createProvider, openAICompletionsApi } from "@earendil-works/pi-ai";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  pi.registerProvider(createProvider({
    id: "native-local",
    name: "Native Local",
    baseUrl: "http://localhost:8080/v1",
    auth: {
      apiKey: {
        name: "Local server API key",
        async login(interaction) {
          return {
            type: "api_key",
            key: await interaction.prompt({ type: "secret", message: "API key" })
          };
        },
        async resolve({ credential }) {
          return credential?.key
            ? { auth: { apiKey: credential.key }, source: "stored API key" }
            : undefined;
        }
      }
    },
    models: [],
    api: openAICompletionsApi()
  }));

  // Legacy provider-config form:
  // Override baseUrl for existing provider
  pi.registerProvider("anthropic", {
    baseUrl: "https://proxy.example.com"
  });

  // Register new provider with models
  pi.registerProvider("my-provider", {
    name: "My Provider",
    baseUrl: "https://api.example.com",
    apiKey: "$MY_API_KEY",
    api: "openai-completions",
    models: [
      {
        id: "my-model",
        name: "My Model",
        reasoning: false,
        input: ["text", "image"],
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
        contextWindow: 128000,
        maxTokens: 4096
      }
    ]
  });
}
```

扩展工厂也可以是 `async`。对于动态模型发现，在工厂中获取并注册模型，而不是在 `session_start` 中。pi 会在启动继续之前等待工厂，因此提供商在交互式启动期间以及对 `pi --list-models` 可用。

## 覆盖现有提供商

最简单的用例：将现有提供商通过代理重定向。

```typescript
// All Anthropic requests now go through your proxy
pi.registerProvider("anthropic", {
  baseUrl: "https://proxy.example.com"
});

// Add custom headers to OpenAI requests
pi.registerProvider("openai", {
  headers: {
    "X-Custom-Header": "value"
  }
});

// Both baseUrl and headers
pi.registerProvider("google", {
  baseUrl: "https://ai-gateway.corp.com/google",
  headers: {
    "X-Corp-Auth": "$CORP_AUTH_TOKEN"  // env var or literal
  }
});
```

当仅提供 `baseUrl` 和/或 `headers`（无 `models`）时，该提供商的所有现有模型会保留，并使用新端点。

## 注册新提供商

要添加全新提供商，请连同所需配置一起指定 `models`。

若模型列表来自远程端点，使用异步扩展工厂：

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

这会在启动完成前注册获取到的模型。

```typescript
pi.registerProvider("my-llm", {
  baseUrl: "https://api.my-llm.com/v1",
  apiKey: "$MY_LLM_API_KEY",  // env var reference
  api: "openai-completions",  // which streaming API to use
  models: [
    {
      id: "my-llm-large",
      name: "My LLM Large",
      reasoning: true,        // supports extended thinking
      input: ["text", "image"],
      cost: {
        input: 3.0,           // $/million tokens
        output: 15.0,
        cacheRead: 0.3,
        cacheWrite: 3.75
      },
      contextWindow: 200000,
      maxTokens: 16384
    }
  ]
});
```

提供 `models` 时，它会**替换**该提供商的所有现有模型。

`apiKey` 与自定义请求头值使用与 `models.json` 相同的配置值语法：以 `!command` 开头会对整个值执行命令，`$ENV_VAR` 与 `${ENV_VAR}` 插值环境变量，`$$` 发出字面 `$`，`$!` 发出字面 `!`。

## 注销提供商

使用 `pi.unregisterProvider(name)` 移除先前通过 `pi.registerProvider(name, ...)` 注册的提供商：

```typescript
// Register
pi.registerProvider("my-llm", {
  baseUrl: "https://api.my-llm.com/v1",
  apiKey: "$MY_LLM_API_KEY",
  api: "openai-completions",
  models: [
    {
      id: "my-llm-large",
      name: "My LLM Large",
      reasoning: true,
      input: ["text", "image"],
      cost: { input: 3.0, output: 15.0, cacheRead: 0.3, cacheWrite: 3.75 },
      contextWindow: 200000,
      maxTokens: 16384
    }
  ]
});

// Later, remove it
pi.unregisterProvider("my-llm");
```

注销会移除该提供商的动态模型、API 密钥回退、OAuth 提供商注册与自定义流处理器注册。被覆盖的任何内置模型或提供商行为会恢复。

在初始扩展加载阶段之后的调用会立即生效，因此无需 `/reload`。

### API 类型

`api` 字段决定使用哪种流式实现：

| API | 用于 |
|-----|---------|
| `anthropic-messages` | Anthropic Claude API 及兼容实现 |
| `openai-completions` | OpenAI Chat Completions API 及兼容实现 |
| `openai-responses` | OpenAI Responses API |
| `azure-openai-responses` | Azure OpenAI Responses API |
| `openai-codex-responses` | OpenAI Codex Responses API |
| `mistral-conversations` | Mistral SDK Conversations/Chat 流式 |
| `google-generative-ai` | Google Generative AI API |
| `google-vertex` | Google Vertex AI API |
| `bedrock-converse-stream` | Amazon Bedrock Converse API |

大多数 OpenAI 兼容提供商适用于 `openai-completions`。使用模型级 `thinkingLevelMap` 处理模型特定的思考级别，使用 `compat` 处理提供商特性。`xhigh` 与 `max` 级别为可选加入，需要非 null 映射条目，并可能被不支持的空洞分隔：

```typescript
models: [{
  id: "custom-model",
  // ...
  reasoning: true,
  thinkingLevelMap: {              // map pi levels to provider values; null hides unsupported levels
    minimal: null,
    low: null,
    medium: null,
    high: "default",
    xhigh: null,
    max: "max"
  },
  compat: {
    supportsDeveloperRole: false,   // use "system" instead of "developer"
    supportsReasoningEffort: true,
    maxTokensField: "max_tokens",   // instead of "max_completion_tokens"
    requiresToolResultName: true,   // tool results need name field
    thinkingFormat: "qwen",        // top-level enable_thinking: true
    cacheControlFormat: "anthropic" // Anthropic-style cache_control markers
  }
}]
```

对 OpenRouter 风格的 `reasoning: { effort }` 控制使用 `openrouter`。对 Together 风格的 `reasoning: { enabled }` 控制使用 `together`；启用 `supportsReasoningEffort` 时它也会发送 `reasoning_effort`。对读取 `chat_template_kwargs.enable_thinking` 并需要 `preserve_thinking` 的本地 Qwen 兼容服务器使用 `qwen-chat-template`。
对通过系统提示、最后一个工具定义，以及最后一条用户、助手或工具结果文本内容上的 `cache_control` 暴露 Anthropic 风格提示缓存的 OpenAI 兼容提供商，使用 `cacheControlFormat: "anthropic"`。

对使用 `api: "anthropic-messages"` 的 Anthropic 兼容提供商，若上游模型需要自适应思考（`thinking.type: "adaptive"` 加上 `output_config.effort`），在模型或提供商上设置 `compat.forceAdaptiveThinking: true`。内置自适应 Claude 模型会自动设置。仅对发出空思考签名并期望重放时使用 `signature: ""` 的提供商设置 `compat.allowEmptySignature: true`。

> 迁移说明：Mistral 已从 `openai-completions` 迁移到 `mistral-conversations`。
> 对原生 Mistral 模型使用 `mistral-conversations`。
> 若你有意通过 `openai-completions` 路由 Mistral 兼容/自定义端点，请按需显式设置 `compat` 标志。

### 认证头

若你的提供商期望 `Authorization: Bearer <key>` 但不使用标准 API，设置 `authHeader: true`：

```typescript
pi.registerProvider("custom-api", {
  baseUrl: "https://api.example.com",
  apiKey: "$MY_API_KEY",
  authHeader: true,  // adds Authorization: Bearer header
  api: "openai-completions",
  models: [...]
});
```

密钥会为每个请求解析。显式的请求 `Authorization` 头优先于生成的值。

## OAuth 支持

添加与 `/login` 集成的 OAuth/SSO 认证：

```typescript
import type { OAuthCredentials, OAuthLoginCallbacks } from "@earendil-works/pi-ai";

pi.registerProvider("corporate-ai", {
  baseUrl: "https://ai.corp.com/v1",
  api: "openai-responses",
  models: [...],
  oauth: {
    name: "Corporate AI (SSO)",

    async login(callbacks: OAuthLoginCallbacks): Promise<OAuthCredentials> {
      const method = await callbacks.onSelect({
        message: "Select login method:",
        options: [
          { id: "browser", label: "Browser OAuth" },
          { id: "device", label: "Device code" }
        ]
      });
      if (!method) throw new Error("Login cancelled");

      let code: string;
      if (method === "device") {
        callbacks.onDeviceCode({
          userCode: "ABCD-1234",
          verificationUri: "https://sso.corp.com/device",
          intervalSeconds: 5,
          expiresInSeconds: 900
        });
        code = await pollDeviceCodeUntilComplete();
      } else {
        callbacks.onAuth({ url: "https://sso.corp.com/authorize?..." });
        code = await callbacks.onPrompt({ message: "Enter SSO code:" });
      }

      // Exchange for tokens (your implementation)
      const tokens = await exchangeCodeForTokens(code);

      return {
        refresh: tokens.refreshToken,
        access: tokens.accessToken,
        expires: Date.now() + tokens.expiresIn * 1000
      };
    },

    async refreshToken(credentials: OAuthCredentials, signal: AbortSignal): Promise<OAuthCredentials> {
      const tokens = await refreshAccessToken(credentials.refresh, signal);
      return {
        refresh: tokens.refreshToken ?? credentials.refresh,
        access: tokens.accessToken,
        expires: Date.now() + tokens.expiresIn * 1000
      };
    },

    getApiKey(credentials: OAuthCredentials): string {
      return credentials.access;
    }
  }
});
```

注册后，用户可通过 `/login corporate-ai` 认证。

### OAuthLoginCallbacks

`callbacks` 对象为提供商自有流程提供 UI 无关的交互：

```typescript
interface OAuthLoginCallbacks {
  // Open URL in browser (for OAuth redirects)
  onAuth(params: { url: string }): void;

  // Show device code (for device authorization flow)
  onDeviceCode(params: {
    userCode: string;
    verificationUri: string;
    intervalSeconds?: number;
    expiresInSeconds?: number;
  }): void;

  // Show transient progress
  onProgress?(message: string): void;

  // Prompt user for input (for manual token entry)
  onPrompt(params: { message: string }): Promise<string>;

  // Show an interactive selector, e.g. to choose browser OAuth vs device code
  onSelect(params: {
    message: string;
    options: { id: string; label: string }[];
  }): Promise<string | undefined>;
}
```

### OAuthCredentials

凭证持久化在 `~/.pi/agent/auth.json`：

```typescript
interface OAuthCredentials {
  refresh: string;   // Refresh token (for refreshToken())
  access: string;    // Access token (returned by getApiKey())
  expires: number;   // Expiration timestamp in milliseconds
}
```

## 自定义流式 API

对具有非标准 API 的提供商，实现 `streamSimple`。在编写自己的实现之前，研究现有提供商实现：

**参考实现：**
- [anthropic.ts](https://github.com/earendil-works/pi-mono/blob/main/packages/ai/src/providers/anthropic.ts) - Anthropic Messages API
- [mistral.ts](https://github.com/earendil-works/pi-mono/blob/main/packages/ai/src/providers/mistral.ts) - Mistral Conversations API
- [openai-completions.ts](https://github.com/earendil-works/pi-mono/blob/main/packages/ai/src/providers/openai-completions.ts) - OpenAI Chat Completions
- [openai-responses.ts](https://github.com/earendil-works/pi-mono/blob/main/packages/ai/src/providers/openai-responses.ts) - OpenAI Responses API
- [google.ts](https://github.com/earendil-works/pi-mono/blob/main/packages/ai/src/providers/google.ts) - Google Generative AI
- [amazon-bedrock.ts](https://github.com/earendil-works/pi-mono/blob/main/packages/ai/src/providers/amazon-bedrock.ts) - AWS Bedrock

### 流模式

所有提供商遵循相同模式：

```typescript
import {
  type AssistantMessage,
  type AssistantMessageEventStream,
  type Context,
  type Model,
  type SimpleStreamOptions,
  calculateCost,
  createAssistantMessageEventStream,
} from "@earendil-works/pi-ai";

function streamMyProvider(
  model: Model<any>,
  context: Context,
  options?: SimpleStreamOptions
): AssistantMessageEventStream {
  const stream = createAssistantMessageEventStream();

  (async () => {
    // Initialize output message
    const output: AssistantMessage = {
      role: "assistant",
      content: [],
      api: model.api,
      provider: model.provider,
      model: model.id,
      usage: {
        input: 0,
        output: 0,
        cacheRead: 0,
        cacheWrite: 0,
        totalTokens: 0,
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
      },
      stopReason: "pending",
      timestamp: Date.now(),
    };

    try {
      // Push start event
      stream.push({ type: "start", partial: output });

      // Make API request and process response...
      // Push content events as they arrive and set stopReason from the terminal event.
      if (output.stopReason === "pending") {
        throw new Error("Provider stream ended without a stop reason");
      }
      if (output.stopReason === "error" || output.stopReason === "aborted") {
        throw new Error(output.errorMessage || "An unknown error occurred");
      }

      // Push done event
      stream.push({
        type: "done",
        reason: output.stopReason,
        message: output
      });
      stream.end();
    } catch (error) {
      output.stopReason = options?.signal?.aborted ? "aborted" : "error";
      output.errorMessage = error instanceof Error ? error.message : String(error);
      stream.push({ type: "error", reason: output.stopReason, error: output });
      stream.end();
    }
  })();

  return stream;
}
```

### 事件类型

按此顺序通过 `stream.push()` 推送事件：

1. `{ type: "start", partial: output }` - 流已开始

2. 内容事件（可重复，为每个块跟踪 `contentIndex`）：
   - `{ type: "text_start", contentIndex, partial }` - 文本块开始
   - `{ type: "text_delta", contentIndex, delta, partial }` - 文本块片段
   - `{ type: "text_end", contentIndex, content, partial }` - 文本块结束
   - `{ type: "thinking_start", contentIndex, partial }` - 思考开始
   - `{ type: "thinking_delta", contentIndex, delta, partial }` - 思考片段
   - `{ type: "thinking_end", contentIndex, content, partial }` - 思考结束
   - `{ type: "toolcall_start", contentIndex, partial }` - 工具调用开始
   - `{ type: "toolcall_delta", contentIndex, delta, partial }` - 工具调用 JSON 片段
   - `{ type: "toolcall_end", contentIndex, toolCall, partial }` - 工具调用结束

3. `{ type: "done", reason, message }` 或 `{ type: "error", reason, error }` - 流结束

每个事件中的 `partial` 字段包含当前 `AssistantMessage` 状态。在接收数据时更新 `output.content`，然后将 `output` 作为 `partial` 包含。

### 内容块

在内容块到达时将其添加到 `output.content`：

```typescript
// Text block
output.content.push({ type: "text", text: "" });
stream.push({ type: "text_start", contentIndex: output.content.length - 1, partial: output });

// As text arrives
const block = output.content[contentIndex];
if (block.type === "text") {
  block.text += delta;
  stream.push({ type: "text_delta", contentIndex, delta, partial: output });
}

// When block completes
stream.push({ type: "text_end", contentIndex, content: block.text, partial: output });
```

### 工具调用

工具调用需要累积 JSON 并解析：

```typescript
// Start tool call
output.content.push({
  type: "toolCall",
  id: toolCallId,
  name: toolName,
  arguments: {}
});
stream.push({ type: "toolcall_start", contentIndex: output.content.length - 1, partial: output });

// Accumulate JSON
let partialJson = "";
partialJson += jsonDelta;
try {
  block.arguments = JSON.parse(partialJson);
} catch {}
stream.push({ type: "toolcall_delta", contentIndex, delta: jsonDelta, partial: output });

// Complete
stream.push({
  type: "toolcall_end",
  contentIndex,
  toolCall: { type: "toolCall", id, name, arguments: block.arguments },
  partial: output
});
```

### 用量与成本

从 API 响应更新用量并计算成本：

```typescript
output.usage.input = response.usage.input_tokens;
output.usage.output = response.usage.output_tokens;
output.usage.cacheRead = response.usage.cache_read_tokens ?? 0;
output.usage.cacheWrite = response.usage.cache_write_tokens ?? 0;
output.usage.totalTokens = output.usage.input + output.usage.output +
                           output.usage.cacheRead + output.usage.cacheWrite;
calculateCost(model, output.usage);
```

### 上下文溢出错误

当请求超过模型的上下文窗口时，pi 可通过压缩对话并重试来自动恢复。仅当 pi 将失败识别为溢出时，此恢复才会启动。

检测在最终确定的助手消息上运行：

- `stopReason === "error"`
- `errorMessage` 匹配 pi 已知的溢出模式之一（见 [`packages/ai/src/utils/overflow.ts`](https://github.com/earendil-works/pi-mono/blob/main/packages/ai/src/utils/overflow.ts)）

若你的提供商返回 pi 无法识别的溢出错误消息，从注册该提供商的同一扩展中规范化错误。使用 `message_end` 处理器重写助手消息，使其 `errorMessage` 以 pi 可识别的短语开头。通用回退 `context_length_exceeded` 是最安全的选择。

```typescript
const MY_PROVIDER_OVERFLOW_PATTERN = /your provider's overflow phrase/i;

export default function (pi: ExtensionAPI) {
  pi.registerProvider("my-provider", { /* ... */ });

  pi.on("message_end", (event, ctx) => {
    const message = event.message;
    if (message.role !== "assistant") return;
    if (message.stopReason !== "error") return;
    if (
      message.provider !== "my-provider" &&
      ctx.model?.provider !== "my-provider"
    )
      return;

    const errorMessage = message.errorMessage ?? "";
    if (errorMessage.includes("context_length_exceeded")) return;
    if (!MY_PROVIDER_OVERFLOW_PATTERN.test(errorMessage)) return;

    return {
      message: {
        ...message,
        errorMessage: `context_length_exceeded: ${errorMessage}`,
      },
    };
  });
}
```

`message_end` 在 pi 为自动压缩跟踪助手消息之前运行，因此重写后的 `errorMessage` 是 pi 检查的内容。有了它，pi 将：

1. 从 `errorMessage` 检测溢出。
2. 从活动上下文中丢弃失败的助手消息。
3. 运行压缩。
4. 重试请求一次。

仔细守护重写：

- 将其限定到你的提供商（`message.provider` 与 `ctx.model?.provider`），以免影响其他提供商的无关错误。
- 匹配提供商特定模式，而不是 pi 的通用溢出模式。重写速率限制或节流错误（`rate limit`、`too many requests`）会错误触发压缩，而不是 pi 正常的带退避重试路径。
- 当 `errorMessage` 已包含 `context_length_exceeded` 时跳过，使处理器幂等。

### 注册

注册你的流函数：

```typescript
pi.registerProvider("my-provider", {
  baseUrl: "https://api.example.com",
  apiKey: "$MY_API_KEY",
  api: "my-custom-api",
  models: [...],
  streamSimple: streamMyProvider
});
```

## 测试你的实现

用与内置提供商相同的测试套件测试你的提供商。从 [packages/ai/test/](https://github.com/earendil-works/pi-mono/tree/main/packages/ai/test) 复制并改编这些测试文件：

| 测试 | 用途 |
|------|---------|
| `stream.test.ts` | 基本流式、文本输出 |
| `tokens.test.ts` | Token 计数与用量 |
| `abort.test.ts` | AbortSignal 处理 |
| `empty.test.ts` | 空/最小响应 |
| `context-overflow.test.ts` | 上下文窗口限制 |
| `image-limits.test.ts` | 图像输入处理 |
| `unicode-surrogate.test.ts` | Unicode 边界情况 |
| `tool-call-without-result.test.ts` | 工具调用边界情况 |
| `image-tool-result.test.ts` | 工具结果中的图像 |
| `total-tokens.test.ts` | 总 token 计算 |
| `cross-provider-handoff.test.ts` | 提供商之间的上下文交接 |

使用你的提供商/模型对运行测试以验证兼容性。

## 配置参考

```typescript
interface ProviderConfig {
  /** Display name for the provider in UI such as /login. */
  name?: string;

  /** API endpoint URL. Required when defining models. */
  baseUrl?: string;

  /** API key literal, env interpolation ($ENV_VAR or ${ENV_VAR}), or !command. Required when defining models (unless oauth). */
  apiKey?: string;

  /** API type for streaming. Required at provider or model level when defining models. */
  api?: Api;

  /** Custom streaming implementation for non-standard APIs. */
  streamSimple?: (
    model: Model<Api>,
    context: Context,
    options?: SimpleStreamOptions
  ) => AssistantMessageEventStream;

  /** Custom headers to include in requests. Values use the same resolution syntax as apiKey. */
  headers?: Record<string, string>;

  /** If true, adds Authorization: Bearer header with the resolved API key. */
  authHeader?: boolean;

  /** Models to register. If provided, replaces all existing models for this provider. */
  models?: ProviderModelConfig[];

  /** OAuth provider for /login support. */
  oauth?: {
    name: string;
    login(callbacks: OAuthLoginCallbacks): Promise<OAuthCredentials>;
    refreshToken(credentials: OAuthCredentials, signal: AbortSignal): Promise<OAuthCredentials>;
    getApiKey(credentials: OAuthCredentials): string;
  };
}
```

## 模型定义参考

```typescript
interface ProviderModelConfig {
  /** Model ID (e.g., "claude-sonnet-4-20250514"). */
  id: string;

  /** Display name (e.g., "Claude 4 Sonnet"). */
  name: string;

  /** API type override for this specific model. */
  api?: Api;

  /** API endpoint URL override for this specific model. */
  baseUrl?: string;

  /** Whether the model supports extended thinking. */
  reasoning: boolean;

  /** Maps pi thinking levels to provider/model-specific values; null marks a level unsupported. */
  thinkingLevelMap?: Partial<Record<"off" | "minimal" | "low" | "medium" | "high" | "xhigh" | "max", string | null>>;

  /** Supported input types. */
  input: ("text" | "image")[];

  /** Cost per million tokens (for usage tracking). */
  cost: {
    input: number;
    output: number;
    cacheRead: number;
    cacheWrite: number;
  };

  /** Maximum context window size in tokens. */
  contextWindow: number;

  /** Maximum output tokens. */
  maxTokens: number;

  /** Custom headers for this specific model. */
  headers?: Record<string, string>;

  /** Compatibility settings for the selected API. */
  compat?: {
    // openai-completions
    supportsStore?: boolean;
    supportsDeveloperRole?: boolean;
    supportsReasoningEffort?: boolean;
    supportsUsageInStreaming?: boolean;
    supportsFinishReason?: boolean;
    supportsStrictMode?: boolean;
    supportsOpenAIGrammarTools?: boolean; // openai-completions/openai-responses; false falls back to normal function tools
    maxTokensField?: "max_completion_tokens" | "max_tokens";
    requiresToolResultName?: boolean;
    requiresAssistantAfterToolResult?: boolean;
    requiresThinkingAsText?: boolean;
    requiresReasoningContentOnAssistantMessages?: boolean;
    thinkingFormat?: "openai" | "openrouter" | "deepseek" | "together" | "baseten" | "zai" | "qwen" | "chat-template" | "qwen-chat-template" | "string-thinking" | "ant-ling";
    chatTemplateKwargs?: Record<string, string | number | boolean | null | { "$var": "thinking.enabled" | "thinking.effort"; omitWhenOff?: boolean }>;
    chatTemplateArgs?: Record<string, string | number | boolean | null | { "$var": "thinking.enabled" | "thinking.effort"; omitWhenOff?: boolean }>;
    cacheControlFormat?: "anthropic";
    sessionAffinityFormat?: "openai" | "openai-nosession" | "openrouter";
    sendSessionAffinityHeaders?: boolean;

    // anthropic-messages
    supportsEagerToolInputStreaming?: boolean;
    supportsLongCacheRetention?: boolean;
    sendSessionAffinityHeaders?: boolean;
    supportsCacheControlOnTools?: boolean;
    forceAdaptiveThinking?: boolean;
    allowEmptySignature?: boolean;
    supportsStrictTools?: boolean;
  };
}
```

`openrouter` 发送 `reasoning: { effort }`。`deepseek` 发送 `thinking: { type: "enabled" | "disabled" }`，并在启用时发送 `reasoning_effort`。`together` 发送 `reasoning: { enabled }`，并在启用 `supportsReasoningEffort` 时也发送 `reasoning_effort`。`qwen` 用于 DashScope 风格的顶层 `enable_thinking`。对读取 `chat_template_kwargs.enable_thinking` 并需要 `preserve_thinking` 的本地 Qwen 兼容服务器使用 `qwen-chat-template`。对可配置的 `chat_template_kwargs` 使用 `chat-template`，例如 vLLM 后的 DeepSeek V3.x：`chatTemplateKwargs: { "thinking": { "$var": "thinking.enabled" } }`。当提供商期望在 `chat_template_args` 下使用开关值并可选支持顶层 `reasoning_effort` 时，使用带 `chatTemplateArgs` 的 `thinkingFormat: "baseten"`。
`cacheControlFormat: "anthropic"` 将 Anthropic 风格的 `cache_control` 标记应用于系统提示、最后一个工具定义，以及最后一条用户、助手或工具结果文本内容。
