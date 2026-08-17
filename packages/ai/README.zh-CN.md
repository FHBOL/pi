# @earendil-works/pi-ai

统一的大型语言模型（LLM）API，支持供应商集合、自动认证解析、Token 与成本追踪，以及简单的上下文持久化和会话中途跨模型交接。

**注意**：本库仅包含支持工具调用（即函数调用）的模型，因为这是智能体（agentic）工作流的必要前提。

## 目录

- [支持的供应商](#supported-providers)
- [安装](#installation)
- [快速入门](#quick-start)
- [供应商与模型](#providers-and-models)
  - [供应商工厂](#provider-factories)
  - [所有内置供应商](#all-built-in-providers)
  - [查询模型](#querying-models)
  - [静态目录读取](#static-catalog-reads)
  - [动态供应商](#dynamic-providers)
- [认证（Auth）](#auth)
  - [认证解析机制](#how-auth-resolves)
  - [请求头转换](#transforming-request-headers)
  - [凭据存储](#credential-store)
  - [环境变量](#environment-variables)
- [工具（Tools）](#tools)
  - [定义工具](#defining-tools)
  - [处理工具调用](#handling-tool-calls)
  - [流式传输含部分 JSON 的工具调用](#streaming-tool-calls-with-partial-json)
  - [验证工具参数](#validating-tool-arguments)
  - [完整事件参考](#complete-event-reference)
- [图像输入](#image-input)
- [图像生成](#image-generation)
- [推理/思维（Thinking/Reasoning）](#thinkingreasoning)
  - [统一接口](#unified-interface-streamsimplecompletesimple)
  - [供应商特定选项](#provider-specific-options-streamcomplete)
  - [流式传输推理内容](#streaming-thinking-content)
- [停止原因（Stop Reasons）](#stop-reasons)
- [错误处理（Error Handling）](#error-handling)
  - [中止请求](#aborting-requests)
  - [中止后继续执行](#continuing-after-abort)
  - [调试供应商载荷（Payload）](#debugging-provider-payloads)
- [自定义供应商（Custom Providers）](#custom-providers)
  - [createProvider()](#createprovider)
  - [直接调用 API 实现](#calling-api-implementations-directly)
  - [OpenAI 兼容性设置](#openai-compatibility-settings)
- [用于测试的模拟供应商（Faux Provider for Tests）](#faux-provider-for-tests)
- [跨供应商交接（Cross-Provider Handoffs）](#cross-provider-handoffs)
- [上下文序列化（Context Serialization）](#context-serialization)
- [浏览器使用（Browser Usage）](#browser-usage)
- [打包与树摇（Bundling and Tree Shaking）](#bundling-and-tree-shaking)
- [OAuth 供应商（OAuth Providers）](#oauth-providers)
  - [Vertex AI](#vertex-ai)
  - [CLI 登录](#cli-login)
  - [编程式 OAuth](#programmatic-oauth)
- [从旧版全局 API 迁移（Migrating from the Old Global API）](#migrating-from-the-old-global-api)
- [开发（Development）](#development)
- [许可证（License）](#license)

## 支持的供应商

- **OpenAI**
- **Ant Ling**
- **Azure OpenAI（响应）**
- **OpenAI Codex**（需 ChatGPT Plus/Pro 订阅，要求 OAuth，详见下文）
- **DeepSeek**
- **NVIDIA NIM**
- **Anthropic**
- **Google**
- **Vertex AI**（通过 Vertex AI 使用 Gemini）
- **Mistral**
- **Groq**
- **Cerebras**
- **Cloudflare AI Gateway**
- **Cloudflare Workers AI**
- **xAI**
- **OpenRouter**
- **Vercel AI Gateway**
- **ZAI 编码计划（全球版）**（另提供中国地区专用供应商）
- **MiniMax**（另提供中国地区专用供应商）
- **Together AI**
- **Baseten**
- **Hugging Face**
- **Moonshot AI**（另提供中国地区专用供应商）
- **GitHub Copilot**（需 OAuth，详见下文）
- **Amazon Bedrock**
- **OpenCode Zen**
- **OpenCode Go**
- **Fireworks**（使用兼容 OpenAI 和 Anthropic 的 API）
- **Kimi For Coding**（Moonshot AI 订阅端点，使用兼容 Anthropic 的 API）
- **小米 MiMo**（默认指向 API 计费端点；另为 `cn`/`ams`/`sgp` 地区分别提供 Token 套餐专用供应商）
- **任意 OpenAI 兼容 API**：Ollama、vLLM、LM Studio 等。

## 安装

```bash
npm install @earendil-works/pi-ai
```

TypeBox 导出项（`Type`、`Static` 和 `TSchema`）已从 `@earendil-works/pi-ai` 中重新导出。

## 快速入门

您需构建一个由供应商组成的 `Models` 集合，并在其上执行流式调用。最简启动方式是注册全部内置供应商；若应用关注打包体积，则应仅注册所需供应商（参见 [供应商工厂](#provider-factories) 和 [打包与树摇](#bundling-and-tree-shaking)）。

```typescript
import { Type, type Context, type Tool } from '@earendil-works/pi-ai';
import { builtinModels } from '@earendil-works/pi-ai/providers/all';

// A Models collection with every built-in provider registered
const models = builtinModels();

// Sync lookup against the collection
const model = models.getModel('openai', 'gpt-4o-mini')!;

// Define tools with TypeBox schemas for type safety and validation
const tools: Tool[] = [{
  name: 'get_time',
  description: 'Get the current time',
  parameters: Type.Object({
    timezone: Type.Optional(Type.String({ description: 'Optional timezone (e.g., America/New_York)' }))
  })
}];

// Build a conversation context (easily serializable and transferable between models)
const context: Context = {
  systemPrompt: 'You are a helpful assistant.',
  messages: [{ role: 'user', content: 'What time is it?', timestamp: Date.now() }],
  tools
};

// Option 1: Streaming with all event types.
// Auth resolves through the provider (OPENAI_API_KEY from the environment here).
const s = models.stream(model, context);

for await (const event of s) {
  switch (event.type) {
    case 'start':
      console.log(`Starting with ${event.partial.model}`);
      break;
    case 'text_start':
      console.log('\n[Text started]');
      break;
    case 'text_delta':
      process.stdout.write(event.delta);
      break;
    case 'text_end':
      console.log('\n[Text ended]');
      break;
    case 'thinking_start':
      console.log('[Model is thinking...]');
      break;
    case 'thinking_delta':
      process.stdout.write(event.delta);
      break;
    case 'thinking_end':
      console.log('[Thinking complete]');
      break;
    case 'toolcall_start':
      console.log(`\n[Tool call started: index ${event.contentIndex}]`);
      break;
    case 'toolcall_delta':
      // Partial tool arguments are being streamed
      const partialCall = event.partial.content[event.contentIndex];
      if (partialCall.type === 'toolCall') {
        console.log(`[Streaming args for ${partialCall.name}]`);
      }
      break;
    case 'toolcall_end':
      console.log(`\nTool called: ${event.toolCall.name}`);
      console.log(`Arguments: ${JSON.stringify(event.toolCall.arguments)}`);
      break;
    case 'done':
      console.log(`\nFinished: ${event.reason}`);
      break;
    case 'error':
      console.error(`Error: ${event.error.errorMessage}`);
      break;
  }
}

// Get the final message after streaming, add it to the context
const finalMessage = await s.result();
context.messages.push(finalMessage);

// Handle tool calls if any
const toolCalls = finalMessage.content.filter(b => b.type === 'toolCall');
for (const call of toolCalls) {
  const result = call.name === 'get_time'
    ? new Date().toLocaleString('en-US', {
        timeZone: call.arguments.timezone || 'UTC',
        dateStyle: 'full',
        timeStyle: 'long'
      })
    : 'Unknown tool';

  // Add tool result to context (supports text and images)
  context.messages.push({
    role: 'toolResult',
    toolCallId: call.id,
    toolName: call.name,
    content: [{ type: 'text', text: result }],
    isError: false,
    timestamp: Date.now()
  });
}

// Continue if there were tool calls
if (toolCalls.length > 0) {
  const continuation = await models.complete(model, context);
  context.messages.push(continuation);
  console.log('After tool execution:', continuation.content);
}

console.log(`Total tokens: ${finalMessage.usage.input} in, ${finalMessage.usage.output} out`);
console.log(`Cost: $${finalMessage.usage.cost.total.toFixed(4)}`);

// Option 2: Get complete response without streaming
const response = await models.complete(model, context);

for (const block of response.content) {
  if (block.type === 'text') {
    console.log(block.text);
  } else if (block.type === 'toolCall') {
    console.log(`Tool: ${block.name}(${JSON.stringify(block.arguments)})`);
  }
}
```

本 README 其余部分中的代码片段均假设已按此方式（注册了相关供应商）配置好 `models` 集合。

## 供应商与模型

一个 **供应商（Provider）** 是运行时单元：它拥有自身的模型目录、自身的认证机制（API 密钥解析、OAuth 流程）以及自身的流式行为。`Models` 集合则负责容纳多个供应商，并将每个请求路由至其所属模型对应的供应商。提供商在内部共享 **API 实现**（即线协议）：Anthropic 模型使用 `anthropic-messages`，OpenAI 使用 `openai-responses`，而 xAI、Groq、Cerebras、OpenRouter 以及大多数其他提供商则共享 `openai-completions`。混合 API 的提供商（如 GitHub Copilot、OpenCode Zen）会按模型进行分发。

### 提供商工厂（Provider Factories）

对于仅需特定提供商的应用，每个内置提供商均对应一个独立的工厂函数；每个工厂均为子路径导入，仅加载该提供商自身的模型目录：

```typescript
import { anthropicProvider } from '@earendil-works/pi-ai/providers/anthropic';
import { openaiProvider } from '@earendil-works/pi-ai/providers/openai';
import { openrouterProvider } from '@earendil-works/pi-ai/providers/openrouter';
import { amazonBedrockProvider } from '@earendil-works/pi-ai/providers/amazon-bedrock';
// ...one module per provider in the Supported Providers list

const models = createModels();
models.setProvider(anthropicProvider());
models.setProvider(openrouterProvider());
```

提供商工厂会导入其模型目录及一个懒加载的 API 封装器，但不会导入其他提供商。借助打包器（bundler）的代码分割功能，SDK 实现（例如 `@anthropic-ai/sdk`、`openai`、`@google/genai` 等）将保留在懒加载代码块中，并仅在首次请求对应 API 的模型时才被加载。

### 所有内置提供商

对于需要全部功能的应用（如快速入门示例所示）：

```typescript
import { builtinModels } from '@earendil-works/pi-ai/providers/all';

const models = builtinModels(); // a Models collection with every built-in provider registered
```

该导入语句会加载所有模型目录及每个内置提供商工厂。这是一个体积较大、显式声明的入口点。`builtinModels()` 接受与 `createModels()` 相同的选项（`credentials`、`authContext`）；若需自行将其注册到集合中，可调用 `builtinProviders()` 获取提供商数组。

### 查询模型

读取操作是同步的，返回最近已知的模型列表：

```typescript
const providers = models.getProviders();           // registered Provider objects
const provider = models.getProvider('anthropic');  // one provider

const all = models.getModels();                    // every model across providers
const anthropicModels = models.getModels('anthropic');
const model = models.getModel('anthropic', 'claude-sonnet-4-5');

for (const m of anthropicModels) {
  console.log(`${m.id}: ${m.name}`);
  console.log(`  API: ${m.api}`);
  console.log(`  Context: ${m.contextWindow} tokens`);
  console.log(`  Vision: ${m.input.includes('image')}`);
  console.log(`  Reasoning: ${m.reasoning}`);
}
```

动态列出的模型类型为 `Model<Api>`。当需要 API 特定的选项类型时，可使用 `hasApi()` 类型守卫进行窄化：

```typescript
import { hasApi } from '@earendil-works/pi-ai';

const m = models.getModel('anthropic', 'claude-sonnet-4-5');
if (m && hasApi(m, 'anthropic-messages')) {
  // m: Model<'anthropic-messages'> — stream options fully typed
  models.stream(m, context, { thinkingEnabled: true, thinkingBudgetTokens: 2048 });
}
```

### 静态目录读取

对于希望直接访问生成的内置目录（具备完整字面量类型支持，且提供方 ID 与模型 ID 均支持自动补全）、且不依赖任何集合的工具类应用：

```typescript
import { getBuiltinModel, getBuiltinModels, getBuiltinProviders } from '@earendil-works/pi-ai/providers/all';

const model = getBuiltinModel('openai', 'gpt-4o-mini'); // typed Model<'openai-responses'>
const providers = getBuiltinProviders();
const anthropic = getBuiltinModels('anthropic');
```

### 动态提供商

某些提供商可能拥有动态模型列表（例如一个运行中的 llama.cpp 服务器，或一个实时更新的 OpenRouter 列表）。读取操作仍保持同步；而获取最新列表则需显式调用异步方法：

```typescript
// getModels() returns the last-known list (empty before the first refresh)
await models.refresh({ providers: ['llamacpp'] }); // refresh one provider
await models.refresh();                            // refresh all providers concurrently, best-effort
const fresh = models.getModel('llamacpp', 'qwen3-30b');
```

静态内置提供商对 `refresh()` 调用不执行任何操作。如需构建动态提供商，请参阅 [`createProvider()`](#createprovider)。

## 认证（Auth）

每个提供商自主管理其认证逻辑：包括 API 密钥如何解析（存储的凭据、环境变量、AWS 配置文件或 gcloud ADC 等环境来源），以及在支持的情况下实现 OAuth 登录/刷新流程。

### 认证解析机制

当你调用 `models.stream()` 时，集合会通过所属提供商解析认证信息，并将其合并至请求中。显式指定的每请求值始终具有最高优先级：

```typescript
// Resolved through the provider (env var, stored credential, OAuth token):
await models.complete(model, context);

// Explicit key wins over anything the provider would resolve:
await models.complete(model, context, { apiKey: 'sk-explicit' });
```

你可在不发起实际请求的前提下检查认证解析结果。传入提供商 ID 可获取该提供商范围内的认证信息；传入模型对象则还会包含其静态定义的 `model.headers`：

```typescript
const providerAuth = await models.getAuth(model.provider);
const modelAuth = await models.getAuth(model);

if (modelAuth) {
  console.log(`configured via ${modelAuth.source}`); // e.g. "ANTHROPIC_API_KEY", "OAuth", "stored credential"
  console.log(modelAuth.auth.headers);              // Provider auth headers + model.headers
} else {
  console.log('not configured');
}
```

上述两种重载形式均会解析凭据，在必要时刷新已过期的 OAuth Token，并可能返回由认证派生出的 `apiKey`、`headers` 或 `baseUrl`。若提供商尚未配置，`getAuth()` 将返回 `undefined`；若发生实质性错误（例如 `"oauth"`：Token 刷新失败，凭据将保留以供重新登录；`"auth"`：密钥解析或凭据存储失败），则会以 `ModelsError` 拒绝 Promise。请求路径中出现的同类错误，将以流式错误（stream errors）的形式暴露。

`getAuth()`、`checkAuth()`、`getAvailable()`、登录（login）和登出（logout）均支持通过其现有 options 参数或交互对象传入可选的调用方取消信号（caller cancellation signal）；若未提供信号，则这些操作将保持无界（unbounded）状态。提供商的 `login`、`ApiKeyAuth.check`、`ApiKeyAuth.resolve` 和 `OAuthAuth.refresh` 实现始终接收一个具体明确的取消信号，并必须在阻塞型任务中尊重并响应该信号。

### 请求头转换（Transforming Request Headers）

`Models.stream()`、`complete()`、`streamSimple()` 和 `completeSimple()` 均接受一个仅限 Models 层使用的 `transformHeaders` 选项。该函数会在提供商认证、`model.headers` 及显式传入的 `options.headers` 合并完成之后、但在调用提供商分发逻辑之前执行一次：

```typescript
const response = await models.completeSimple(model, context, {
  headers: { "X-Client": "my-app" },
  transformHeaders: async (headers) => ({
    ...headers,
    "X-Request-ID": crypto.randomUUID(),
  }),
});
```

其执行顺序如下：

```text
provider auth headers -> model.headers -> explicit options.headers -> transformHeaders -> Provider.stream*()
```

请求头名称不区分大小写地进行合并。显式指定的请求头会覆盖认证或模型所定义的请求头；而 `transformHeaders` 具有最终控制权；若返回 `null` 表示该请求头将被移除，从而抑制下层默认值（支持删除语义）。

`transformHeaders` 属于 `Models` 层，而非 `Provider` 层。`Models` 的具体实现必须消费该选项，并在调用 `Provider.stream*()` 前将其移除。提供商的具体实现持续接收标准的 `ApiStreamOptions` 或 `SimpleStreamOptions`，永远不会自行处理该转换逻辑。请使用此选项替代在调用 `stream*()` 前手动调用 `getAuth(model)` —— 后者会导致请求认证被重复解析两次。

### 凭据存储（Credential Store）

已存储的凭据（例如交互式输入的 API 密钥、OAuth Token）保存在 `CredentialStore` 中——每个提供商仅对应一个带类型标记的凭据。pi-ai 默认提供一个内存中的实现；应用程序可注入持久化存储方案：```typescript
import { createModels, type CredentialStore } from '@earendil-works/pi-ai';

const models = createModels({ credentials: myFileBackedStore });
// builtinModels() takes the same options:
// const models = builtinModels({ credentials: myFileBackedStore });
```

该合约规模很小：包含 `read(providerId)`、用于获取非密钥型元数据 `{ providerId, type }` 的 `list()`、唯一写入路径 `modify(providerId, fn)`（即序列化的读-修改-写操作），以及 `delete(providerId)`。每个操作均支持可选的取消选项。枚举操作不得解析密钥，也不得执行已配置的密钥命令。OAuth 令牌刷新在 `modify` 内部执行，因此并发请求与进程无法对已轮转的令牌进行重复刷新。一个已存储的凭据 *拥有* 其对应的提供者：仅当未存储任何凭据时才查阅环境变量；而刷新失败时，绝不会静默回退至环境变量中的密钥。

API 密钥凭据使用与 pi 的 `auth.json` 相同的判别器，并可携带作用域限定于提供者的环境变量/配置值：

```typescript
const credential = {
  type: 'api_key',
  key: '...',
  env: {
    CLOUDFLARE_ACCOUNT_ID: 'account-id',
    CLOUDFLARE_GATEWAY_ID: 'gateway-id'
  }
} as const;
```

### 环境变量

内置提供者会解析以下环境变量（Node.js 环境；在浏览器中需显式传入 `apiKey`）：

| 提供者 | 环境变量 |
|--------|-----------|
| OpenAI | `OPENAI_API_KEY` |
| Ant Ling | `ANT_LING_API_KEY` |
| Azure OpenAI | `AZURE_OPENAI_API_KEY` + `AZURE_OPENAI_BASE_URL`（例如 `https://{resource}.ai.azure.com`）或 `AZURE_OPENAI_RESOURCE_NAME`。支持 `*.openai.azure.com`、`*.cognitiveservices.azure.com` 和 `*.ai.azure.com`；根端点将自动规范化为 `/openai/v1`。可选：`AZURE_OPENAI_API_VERSION`（默认为 `v1`）、`AZURE_OPENAI_DEPLOYMENT_NAME_MAP`。 |
| Anthropic | `ANTHROPIC_API_KEY` 或 `ANTHROPIC_OAUTH_TOKEN` |
| DeepSeek | `DEEPSEEK_API_KEY` |
| NVIDIA NIM | `NVIDIA_API_KEY` |
| Google | `GEMINI_API_KEY` |
| Vertex AI | `GOOGLE_CLOUD_API_KEY` 或 `GOOGLE_CLOUD_PROJECT`（或 `GCLOUD_PROJECT`）+ `GOOGLE_CLOUD_LOCATION` + ADC（Application Default Credentials） |
| Mistral | `MISTRAL_API_KEY` |
| Groq | `GROQ_API_KEY` |
| Cerebras | `CEREBRAS_API_KEY` |
| Cloudflare AI Gateway | `CLOUDFLARE_API_KEY` + `CLOUDFLARE_ACCOUNT_ID` + `CLOUDFLARE_GATEWAY_ID` |
| Cloudflare Workers AI | `CLOUDFLARE_API_KEY` + `CLOUDFLARE_ACCOUNT_ID` |
| xAI | `XAI_API_KEY` |
| Fireworks | `FIREWORKS_API_KEY` |
| Together AI | `TOGETHER_API_KEY` |
| Baseten | `BASETEN_API_KEY` |
| OpenRouter | `OPENROUTER_API_KEY` |
| Vercel AI Gateway | `AI_GATEWAY_API_KEY` |
| ZAI 编码计划（全球版） | `ZAI_API_KEY` |
| ZAI 编码计划（中国版） | `ZAI_CODING_CN_API_KEY` |
| MiniMax（全球版） | `MINIMAX_API_KEY` |
| MiniMax（中国版） | `MINIMAX_CN_API_KEY` |
| Moonshot AI / Moonshot AI（中国版） | `MOONSHOT_API_KEY` |
| Hugging Face | `HF_TOKEN` |
| OpenCode Zen / OpenCode Go | `OPENCODE_API_KEY` |
| Kimi For Coding | `KIMI_API_KEY` |
| Qwen Token Plan | `QWEN_TOKEN_PLAN_API_KEY` |
| Qwen Token Plan（中国版） | `QWEN_TOKEN_PLAN_CN_API_KEY` |
| 小米 MiMo（API 计费） | `XIAOMI_API_KEY` |
| 小米 MiMo Token Plan（中国版） | `XIAOMI_TOKEN_PLAN_CN_API_KEY` |
| 小米 MiMo Token Plan（阿姆斯特丹） | `XIAOMI_TOKEN_PLAN_AMS_API_KEY` |
| 小米 MiMo Token Plan（新加坡） | `XIAOMI_TOKEN_PLAN_SGP_API_KEY` |
| GitHub Copilot | `COPILOT_GITHUB_TOKEN` |

Amazon Bedrock 解析环境中的 AWS 凭据（包括 `AWS_PROFILE`、访问密钥对、`AWS_BEARER_TOKEN_BEDROCK`、ECS 任务角色、Web 身份令牌）；其提供者专属登录流程支持承载令牌（Bearer Token）、AWS 配置文件以及现有凭据链。Vertex AI 则解析显式指定的密钥，或通过 gcloud 的 Application Default Credentials（ADC）配合项目 ID 与区域信息；其提供者专属登录流程支持 API 密钥、ADC 及服务账号文件。

## 工具（Tools）

工具使大语言模型（LLM）能够与外部系统交互。本库使用 TypeBox 模式（schema）定义类型安全的工具，并借助 TypeBox 内置的验证器与值转换工具实现自动验证。TypeBox 模式可序列化和反序列化为纯 JSON 格式，使其非常适合分布式系统。

### 定义工具

```typescript
import { Type, type Tool, StringEnum } from '@earendil-works/pi-ai';

// Define tool parameters with TypeBox
const weatherTool: Tool = {
  name: 'get_weather',
  description: 'Get current weather for a location',
  parameters: Type.Object({
    location: Type.String({ description: 'City name or coordinates' }),
    units: StringEnum(['celsius', 'fahrenheit'], { default: 'celsius' })
  })
};

// Note: For Google API compatibility, use StringEnum helper instead of Type.Enum
// Type.Enum generates anyOf/const patterns that Google doesn't support

const bookMeetingTool: Tool = {
  name: 'book_meeting',
  description: 'Schedule a meeting',
  parameters: Type.Object({
    title: Type.String({ minLength: 1 }),
    startTime: Type.String({ format: 'date-time' }),
    endTime: Type.String({ format: 'date-time' }),
    attendees: Type.Array(Type.String({ format: 'email' }), { minItems: 1 })
  })
};
```

### 工具的受限采样（Constrained Sampling）

工具可选择启用提供者端的受限采样功能。对于 JSON Schema 类型的工具，设置 `strict: 'prefer'` 表示：若当前提供者支持，则优先使用其端侧严格的模式校验；否则回退至常规工具调用方式。设置 `strict: 'require'` 表示：若当前活跃的提供者或模型不支持该严格模式，则直接失败。设置 `constrainedSampling: false` 可显式禁用此功能；其行为与完全省略该字段一致。```typescript
const strictTool: Tool = {
  name: 'edit_file',
  description: 'Edit a file',
  parameters: Type.Object({
    path: Type.String(),
    content: Type.String()
  }, { additionalProperties: false }),
  constrainedSampling: { type: 'json_schema', strict: 'prefer' }
};
```

严格遵循 JSON Schema 的采样功能支持以下平台：OpenAI、Anthropic、Amazon Bedrock Converse 中受支持的模型、Mistral，以及通过 Google Generative AI 和 Vertex 适配器调用的 Gemini 3 工具。Google 使用 `VALIDATED` 函数调用模式（或在显式请求时使用 `ANY` 模式）；早期版本的 Gemini 在 `strict: 'prefer'` 场景下会降级处理，而对 `strict: 'require'` 则直接拒绝，因其无法强制执行必需参数。Bedrock 的严格工具能力由模型结构化输出元数据生成；自定义 Bedrock 模型可通过覆盖 `compat.supportsStrictMode` 来启用该能力。OpenAI 的 Responses 和 Chat Completions 还可借助 OpenAI Lark 或正则表达式（regex）语法变体，输出符合语法规则的自定义工具。若同时提供多种 OpenAI 语法变体，Lark 将优先于 regex 被选用。当当前激活模型支持语法工具时，语法约束才会被强制执行；否则，该工具将回退至常规函数/JSON Schema 处理方式。语法工具能力属于模型元数据：生成的模型目录会在满足以下条件的端点上为 GPT-5+ 模型设置 `compat.supportsOpenAIGrammarTools` 标志——即该端点能透传 OpenAI 自定义工具（包括 OpenAI、OpenAI Codex、Azure OpenAI Responses、GitHub Copilot、opencode 和 Cloudflare AI Gateway）。OpenAI 会拒绝为 GPT-5 之前版本的模型指定 `type: "custom"` 工具；而会对工具 Schema 进行标准化处理的网关（例如 OpenRouter）则会损坏此类工具定义，因此该标志在其他位置保持关闭状态。自定义模型定义可通过 `compat` 显式启用该能力。具备语法能力的模型会拒绝未指定非空支持变体的语法配置。原生语法工具必须具有一个对象类型的参数 Schema，且该 Schema 中**恰好包含一个必需的字符串类型属性**：

```typescript
const patchTool: Tool = {
  name: 'apply_patch',
  description: 'Apply a patch',
  parameters: Type.Object({
    input: Type.String()
  }, { additionalProperties: false }),
  constrainedSampling: {
    type: 'grammar',
    variants: {
      openai_lark: 'start: /.+/s'
    }
  }
};
```

### 工具调用处理

工具结果使用内容块（content blocks）表示，可同时包含文本与图像：

```typescript
import { readFileSync } from 'fs';

const context: Context = {
  messages: [{ role: 'user', content: 'What is the weather in London?', timestamp: Date.now() }],
  tools: [weatherTool]
};

const response = await models.complete(model, context);

// Check for tool calls in the response
for (const block of response.content) {
  if (block.type === 'toolCall') {
    // Execute your tool with the arguments
    // See "Validating Tool Arguments" section for validation
    const result = await executeWeatherApi(block.arguments);

    // Add tool result with text content
    context.messages.push({
      role: 'toolResult',
      toolCallId: block.id,
      toolName: block.name,
      content: [{ type: 'text', text: JSON.stringify(result) }],
      isError: false,
      timestamp: Date.now()
    });
  }
}

// Tool results can also include images (for vision-capable models)
const imageBuffer = readFileSync('chart.png');
context.messages.push({
  role: 'toolResult',
  toolCallId: 'tool_xyz',
  toolName: 'generate_chart',
  content: [
    { type: 'text', text: 'Generated chart showing temperature trends' },
    { type: 'image', data: imageBuffer.toString('base64'), mimeType: 'image/png' }
  ],
  isError: false,
  timestamp: Date.now()
});
```

### 流式传输工具调用与部分 JSON

在流式传输过程中，工具调用参数会随着数据到达而逐步解析。这使得 UI 可在完整参数尚未接收完毕前即进行实时更新：

```typescript
const s = models.stream(model, context);

for await (const event of s) {
  if (event.type === 'toolcall_delta') {
    const toolCall = event.partial.content[event.contentIndex];

    // toolCall.arguments contains partially parsed JSON during streaming
    // This allows for progressive UI updates
    if (toolCall.type === 'toolCall' && toolCall.arguments) {
      // BE DEFENSIVE: arguments may be incomplete
      // Example: Show file path being written even before content is complete
      if (toolCall.name === 'write_file' && toolCall.arguments.path) {
        console.log(`Writing to: ${toolCall.arguments.path}`);

        // Content might be partial or missing
        if (toolCall.arguments.content) {
          console.log(`Content preview: ${toolCall.arguments.content.substring(0, 100)}...`);
        }
      }
    }
  }

  if (event.type === 'toolcall_end') {
    // Here toolCall.arguments is complete (but not yet validated)
    const toolCall = event.toolCall;
    console.log(`Tool completed: ${toolCall.name}`, toolCall.arguments);
  }
}
```

**关于部分工具参数的重要说明：**  
- 在 `toolcall_delta` 事件中，`arguments` 字段包含对部分 JSON 的尽力解析结果；  
- 字段可能缺失或不完整——使用前务必检查其是否存在；  
- 字符串值可能在单词中间被截断；  
- 数组可能尚未完整接收；  
- 嵌套对象可能仅部分填充；  
- `arguments` 至少保证为一个空对象 `{}`，绝不会为 `undefined`；  
- Google 提供商不支持函数调用流式传输。相反，您将仅收到一个 `toolcall_delta` 事件，其中包含完整的参数。

### 工具参数校验

在实现您自己的工具执行循环时，请使用 `validateToolCall` 函数，在将参数传递给工具前对其进行校验：

```typescript
import { validateToolCall, type Tool } from '@earendil-works/pi-ai';

const tools: Tool[] = [weatherTool, calculatorTool];
const s = models.stream(model, { messages, tools });

for await (const event of s) {
  if (event.type === 'toolcall_end') {
    const toolCall = event.toolCall;

    try {
      // Validate arguments against the tool's schema (throws on invalid args)
      const validatedArgs = validateToolCall(tools, toolCall);
      const result = await executeMyTool(toolCall.name, validatedArgs);
      // ... add tool result to context
    } catch (error) {
      // Validation failed - return error as tool result so model can retry
      context.messages.push({
        role: 'toolResult',
        toolCallId: toolCall.id,
        toolName: toolCall.name,
        content: [{ type: 'text', text: error.message }],
        isError: true,
        timestamp: Date.now()
      });
    }
  }
}
```

### 完整事件参考表

助手消息生成过程中发出的所有流式事件：

| 事件类型 | 描述 | 关键属性 |
|----------|------|-----------|
| `start` | 流式传输开始 | `partial`: 助手消息的初始结构 |
| `text_start` | 文本块开始 | `contentIndex`: 在内容数组中的位置 |
| `text_delta` | 接收到文本片段 | `delta`: 新增文本，`contentIndex`: 在内容数组中的位置 |
| `text_end` | 文本块完成 | `content`: 完整文本内容，`contentIndex`: 在内容数组中的位置 |
| `thinking_start` | 思考块开始 | `contentIndex`: 在内容数组中的位置 |
| `thinking_delta` | 接收到思考片段 | `delta`: 新增思考文本，`contentIndex`: 在内容数组中的位置 |
| `thinking_end` | 思考块完成 | `content`: 完整思考内容，`contentIndex`: 在内容数组中的位置 |
| `toolcall_start` | 工具调用开始 | `contentIndex`: 在内容数组中的位置 |
| `toolcall_delta` | 工具参数流式传输 | `delta`: JSON 片段，`partial.content[contentIndex].arguments`: 已解析的部分参数 |
| `toolcall_end` | 工具调用完成 | `toolCall`: 经完整校验的工具调用对象，含 `id`、`name` 和 `arguments` 字段 |
| `done` | 流式传输结束 | `reason`: 结束原因（"stop"、"length" 或 "toolUse"），`message`: 最终的助手消息 |
| `error` | 发生错误 | `reason`: 错误类型（"error" 或 "aborted"），`error`: 包含部分已生成内容的 `AssistantMessage` 对象 |不同内容块的流式事件不保证连续。提供商可能在同一个上游数据块中发出文本、思考和工具调用的增量更新（delta），而 pi 可能将对应的事件交错呈现，例如 `text_start`、`text_delta`、`toolcall_start`、`text_delta`、`toolcall_delta`。使用者必须使用 `contentIndex` 将每个增量/结束事件与其对应的内容块关联起来，且不得假设某个块的 `*_start` / `*_delta` / `*_end` 序列不会被其他块的事件所中断。

## 图像输入

具备视觉能力的模型可以处理图像。您可通过 `input` 属性检查某模型是否支持图像输入。若您向非视觉模型传入图像，这些图像将被静默忽略。

```typescript
import { readFileSync } from 'fs';

const model = models.getModel('openai', 'gpt-4o-mini')!;

// Check if model supports images
if (model.input.includes('image')) {
  console.log('Model supports vision');
}

const imageBuffer = readFileSync('image.png');
const base64Image = imageBuffer.toString('base64');

const response = await models.complete(model, {
  messages: [{
    role: 'user',
    content: [
      { type: 'text', text: 'What is in this image?' },
      { type: 'image', data: base64Image, mimeType: 'image/png' }
    ],
    timestamp: Date.now()
  }]
});

// Access the response
for (const block of response.content) {
  if (block.type === 'text') {
    console.log(block.text);
  }
}
```

## 图像生成

图像生成拥有与文本/对话生成相分离的独立 API 接口，其设计与对话侧保持一致：`ImagesModels` 集合中包含 `ImagesProvider` 实例；读取操作为同步；认证通过所属提供方解析。图像生成是一个单次调用（one-shot）API：`generateImages()` 会等待提供方响应，并直接返回最终的 `AssistantImages` 结果 —— 请勿对图像生成使用对话或流式 API。

### 基础图像生成

```typescript
import { builtinImagesModels } from '@earendil-works/pi-ai/providers/all';

// Every built-in image-generation provider; accepts the same options as createModels()
const imagesModels = builtinImagesModels();

const model = imagesModels.getModel('openrouter', 'google/gemini-2.5-flash-image')!;

// Auth resolves through the provider (OPENROUTER_API_KEY here); explicit apiKey wins
const result = await imagesModels.generateImages(model, {
  input: [{ type: 'text', text: 'Generate a red circle on a plain white background.' }]
});

for (const block of result.output) {
  if (block.type === 'text') {
    console.log(block.text);
  } else if (block.type === 'image') {
    console.log(block.mimeType);
    console.log(block.data.substring(0, 32));
  }
}
```

与对话侧类似，您也可通过组合部件构建该集合：`createImagesModels({ credentials?, authContext? })`；来自 `@earendil-works/pi-ai/providers/openrouter-images` 的 `openrouterImagesProvider()` 工厂函数；以及用于自定义图像提供方的 `createImagesProvider({ id, auth, models, refreshModels?, api })`（配合 `imagesModels.refresh(provider?)` 实现动态列表）。失败永远不会触发 Promise 拒绝（reject），而是返回一个 `stopReason: "error"` 的 `AssistantImages` 对象。该集合中按提供方作用域划分的 `getAuth(providerId)` 方法，其行为与对话侧完全一致。

旧版全局 API（`getImageModel()` / `getImageModels()` / `getImageProviders()` / `generateImages()`）仍可通过 [兼容性入口点](#migrating-from-the-old-global-api) 访问：

```typescript
import { getImageModel, generateImages } from '@earendil-works/pi-ai/compat';

const model = getImageModel('openrouter', 'google/gemini-2.5-flash-image');
const result = await generateImages(model, {
  input: [{ type: 'text', text: 'Generate a red circle on a plain white background.' }]
}, {
  apiKey: process.env.OPENROUTER_API_KEY
});
```

部分模型还支持图像输入：

```typescript
import { readFileSync } from 'fs';

const imageBuffer = readFileSync('input.png');
const result = await imagesModels.generateImages(model, {
  input: [
    { type: 'text', text: 'Create a variation of this image with a blue background.' },
    { type: 'image', data: imageBuffer.toString('base64'), mimeType: 'image/png' }
  ]
});
```

请通过模型元数据检查其能力：

```typescript
console.log(model.input);   // ['text', 'image']
console.log(model.output);  // ['image'] or ['image', 'text']
```

### 注意事项与限制

- 图像模型位于 `ImagesModels` 集合中，而对话模型位于 `Models` 集合中；二者为相互独立的接口面。
- 请使用 `generateImages()`，而非对话或流式 API。
- 图像生成模型不参与工具调用（tool calling）。
- 输出结果位于 `AssistantImages.output` 中，可同时包含 base64 编码的 `ImageContent` 块与 `TextContent` 块。
- 部分模型仅返回图像，另一些则同时返回图像与文本。请查阅 `model.output`。
- 部分模型支持图像输入，另一些则仅为纯文本到图像（text-to-image）模型。请查阅 `model.input`。
- 与流式 API 类似，图像生成也支持 `apiKey`、`signal`、`headers`、`onPayload` 和 `onResponse` 等选项；返回结果中也可能包含 `stopReason`、`responseId` 和 `usage` 字段。
- 若您希望模型在对话中分析图像或调用工具，请使用常规对话 API，并选择支持图像输入的模型。
- 当前，图像生成仅通过 OpenRouter 这一家提供商提供。

## 思考/推理（Thinking/Reasoning）

许多模型支持思考/推理能力，即能够展示其内部推理过程。您可通过 `reasoning` 属性检查某模型是否支持推理功能。若您向不支持推理的模型传递推理相关选项，这些选项将被静默忽略。

### 统一接口（streamSimple / completeSimple）

```typescript
// Many models across providers support thinking/reasoning
const model = models.getModel('anthropic', 'claude-sonnet-4-5')!;
// or models.getModel('openai', 'gpt-5-mini');
// or models.getModel('google', 'gemini-2.5-flash');
// or models.getModel('xai', 'grok-4.5');

// Check if model supports reasoning
if (model.reasoning) {
  console.log('Model supports reasoning/thinking');
}

// Use the simplified reasoning option
const response = await models.completeSimple(model, {
  messages: [{ role: 'user', content: 'Solve: 2x + 5 = 13', timestamp: Date.now() }]
}, {
  reasoning: 'medium'  // 'minimal' | 'low' | 'medium' | 'high' | 'xhigh' | 'max'
});

// Access thinking and text blocks
for (const block of response.content) {
  if (block.type === 'thinking') {
    console.log('Thinking:', block.thinking);
  } else if (block.type === 'text') {
    console.log('Response:', block.text);
  }
}
```

`xhigh` 和 `max` 是模型特定的、需显式启用的推理等级。请使用 `getSupportedThinkingLevels(model)` 判断具体模型是否暴露任一等级；例如 GPT-5.6 这类模型可同时暴露两个等级。

### 提供方特定选项（stream / complete）

`models.stream()` / `complete()` 接受其所属 API 的全部选项集。请使用 `hasApi()` 将动态查得的模型类型缩小至其对应 API 类型，以获得完整的选项类型提示：

```typescript
import { hasApi } from '@earendil-works/pi-ai';

// OpenAI Reasoning (o1, o3, gpt-5)
const openaiModel = models.getModel('openai', 'gpt-5-mini')!;
if (hasApi(openaiModel, 'openai-responses')) {
  await models.complete(openaiModel, context, {
    reasoningEffort: 'medium',
    reasoningSummary: 'detailed'  // OpenAI Responses API only
  });
}

// Anthropic Thinking
const anthropicModel = models.getModel('anthropic', 'claude-sonnet-4-5')!;
if (hasApi(anthropicModel, 'anthropic-messages')) {
  await models.complete(anthropicModel, context, {
    thinkingEnabled: true,
    thinkingBudgetTokens: 8192  // Optional token limit
  });
}

// Google Gemini Thinking
const googleModel = models.getModel('google', 'gemini-2.5-flash')!;
if (hasApi(googleModel, 'google-generative-ai')) {
  await models.complete(googleModel, context, {
    thinking: {
      enabled: true,
      budgetTokens: 8192  // -1 for dynamic, 0 to disable
    }
  });
}
```

### 流式传输思考内容

在流式传输过程中，思考内容通过特定事件进行传递：

```typescript
const s = models.streamSimple(model, context, { reasoning: 'high' });

for await (const event of s) {
  switch (event.type) {
    case 'thinking_start':
      console.log('[Model started thinking]');
      break;
    case 'thinking_delta':
      process.stdout.write(event.delta);  // Stream thinking content
      break;
    case 'thinking_end':
      console.log('\n[Thinking complete]');
      break;
  }
}
```

## 停止原因（Stop Reasons）

每个 `AssistantMessage` 均包含一个 `stopReason` 字段，用于指示生成过程如何终止：

- `"pending"` —— 仅出现在部分消息中，表示当前尚无法确定最终停止原因；
- `"stop"` —— 此为模型本轮生成的最终消息；
- `"length"` —— 输出已达到最大 token 限制；
- `"toolUse"` —— 模型正在调用工具，并等待工具返回结果；
- `"error"` —— 生成过程中发生错误；
- `"aborted"` —— 请求已通过 abort signal 被取消。`AssistantMessage` 还可能包含 `responseId` 字段，该字段是底层 API 提供的、特定于供应商的上游响应或消息标识符（若该 API 暴露了此类标识符）。请勿假定所有供应商均始终提供此字段。

## 错误处理

请求失败**绝不会**从流式函数中抛出异常：当请求以错误结束时（包括被中止以及工具调用验证失败），流式 API 将触发一个 `error` 事件，且最终消息中会携带详细的错误信息：

```typescript
// In streaming
for await (const event of s) {
  if (event.type === 'error') {
    // event.reason is either "error" or "aborted"
    // event.error is the AssistantMessage with partial content
    console.error(`Error (${event.reason}):`, event.error.errorMessage);
    console.log('Partial content:', event.error.content);
  }
}

// The final message will have the error details
const message = await s.result();
if (message.stopReason === 'error' || message.stopReason === 'aborted') {
  console.error('Request failed:', message.errorMessage);
  // message.content contains any partial content received before the error
  // message.usage contains partial token counts and costs
}
```

认证失败（例如未配置密钥、OAuth 刷新失败、未知供应商等）也以相同方式呈现：即作为带有 `stopReason: "error"` 的流式错误。

### 中止请求

通过 `abort` 信号，您可以取消正在进行中的请求。被中止的请求其 `stopReason === 'aborted'`：

```typescript
const controller = new AbortController();

// Abort after 2 seconds
setTimeout(() => controller.abort(), 2000);

const s = models.stream(model, {
  messages: [{ role: 'user', content: 'Write a long story', timestamp: Date.now() }]
}, {
  signal: controller.signal
});

for await (const event of s) {
  if (event.type === 'text_delta') {
    process.stdout.write(event.delta);
  } else if (event.type === 'error') {
    // event.reason tells you if it was "error" or "aborted"
    console.log(`${event.reason === 'aborted' ? 'Aborted' : 'Error'}:`, event.error.errorMessage);
  }
}

// Get results (may be partial if aborted)
const response = await s.result();
if (response.stopReason === 'aborted') {
  console.log('Request was aborted:', response.errorMessage);
  console.log('Partial content received:', response.content);
  console.log('Tokens used:', response.usage);
}
```

### 在中止后继续对话

被中止的消息可加入对话上下文，并在后续请求中继续使用：

```typescript
const context = {
  messages: [
    { role: 'user', content: 'Explain quantum computing in detail', timestamp: Date.now() }
  ]
};

// First request gets aborted after 2 seconds
const controller1 = new AbortController();
setTimeout(() => controller1.abort(), 2000);

const partial = await models.complete(model, context, { signal: controller1.signal });

// Add the partial response to context
context.messages.push(partial);
context.messages.push({ role: 'user', content: 'Please continue', timestamp: Date.now() });

// Continue the conversation
const continuation = await models.complete(model, context);
```

### 调试供应商载荷（Payload）

使用 `onPayload` 回调函数可检查发送至供应商的请求载荷。这对于调试请求格式问题或供应商端验证错误非常有用。

```typescript
const response = await models.complete(model, context, {
  onPayload: (payload) => {
    console.log('Provider payload:', JSON.stringify(payload, null, 2));
  }
});
```

该回调函数受 `stream`、`complete`、`streamSimple` 和 `completeSimple` 所支持。

## 自定义供应商（Custom Providers）

### createProvider()

`createProvider()` 函数通过组合若干组件（身份标识、认证机制、模型列表及 API 实现）来构建一个供应商。适用于本地推理服务器、代理服务，或任何兼容 OpenAI/Anthropic 协议的端点：

```typescript
import { createModels, createProvider, envApiKeyAuth, type Model } from '@earendil-works/pi-ai';
import { openAICompletionsApi } from '@earendil-works/pi-ai/api/openai-completions.lazy';

const ollamaModel: Model<'openai-completions'> = {
  id: 'llama-3.1-8b',
  name: 'Llama 3.1 8B (Ollama)',
  api: 'openai-completions',
  provider: 'ollama',
  baseUrl: 'http://localhost:11434/v1',
  reasoning: false,
  input: ['text'],
  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
  contextWindow: 128000,
  maxTokens: 32000
};

const ollama = createProvider({
  id: 'ollama',
  name: 'Ollama',
  baseUrl: 'http://localhost:11434/v1',
  // Every provider declares auth; keyless local servers resolve as configured with no key.
  auth: { apiKey: { name: 'Ollama', resolve: async () => ({ auth: {} }) } },
  models: [ollamaModel],
  api: openAICompletionsApi(),
});

const models = createModels();
models.setProvider(ollama);

await models.complete(models.getModel('ollama', 'llama-3.1-8b')!, context);
```

对于需要真实密钥的供应商，`envApiKeyAuth(displayName, envVars)` 可提供标准行为（已存储凭证优先，其次为首个可用的环境变量）：

```typescript
const proxy = createProvider({
  id: 'my-proxy',
  auth: { apiKey: envApiKeyAuth('My proxy API key', ['MY_PROXY_API_KEY']) },
  models: [/* ... */],
  api: openAICompletionsApi(),
});
```

混合 API 的供应商需传入一个以 `model.api` 为键的映射表；每个模型将分发至其对应 API 的实现：

```typescript
import { anthropicMessagesApi } from '@earendil-works/pi-ai/api/anthropic-messages.lazy';
import { openAIResponsesApi } from '@earendil-works/pi-ai/api/openai-responses.lazy';

const gateway = createProvider({
  id: 'my-gateway',
  auth: { apiKey: envApiKeyAuth('Gateway key', ['GATEWAY_API_KEY']) },
  models: [/* models with api: 'anthropic-messages' or 'openai-responses' */],
  api: {
    'anthropic-messages': anthropicMessagesApi(),
    'openai-responses': openAIResponsesApi(),
  },
});
```

作用于整个供应商的端点或请求转换逻辑，应置于该供应商的 API 实现中：将您作为 `api` 参数传入的 `ProviderStreams` 进行封装，确保每次请求在分发前均经过该转换逻辑。Cloudflare 相关供应商即采用此方式，从已解析的供应商环境变量中实例化账户/网关端点占位符：

```typescript
function tenantStreams(streams: ProviderStreams): ProviderStreams {
  const withTenant = (model: Model<Api>) => ({ ...model, baseUrl: model.baseUrl.replace('{tenant}', tenantId) });
  return {
    stream: (model, context, options) => streams.stream(withTenant(model), context, options),
    streamSimple: (model, context, options) => streams.streamSimple(withTenant(model), context, options),
  };
}

const tenantGateway = createProvider({
  id: 'tenant-gateway',
  auth: { apiKey: envApiKeyAuth('Gateway key', ['GATEWAY_API_KEY']) },
  models: [/* ... */],
  api: tenantStreams(openAICompletionsApi()),
});
```

动态模型列表使用 `fetchModels` 获取。`Models.refresh()` 方法将刷新所有已配置的动态供应商，向其传入有效的 API 密钥或已刷新的 OAuth 凭据。`ModelsStore` 用于持久化动态模型目录；两种存储默认均采用内存实现。其 `read`、`write` 和 `delete` 操作均支持可选的取消信号（cancellation），而 `Models` 则将这些等待操作绑定至供应商刷新信号。

```typescript
const models = createModels({ credentials, modelsStore });
const llamacpp = createProvider({
  id: 'llamacpp',
  auth: { apiKey: { name: 'llama.cpp', resolve: async () => ({ auth: {} }) } },
  models: [],
  fetchModels: async ({ signal }) => fetchModelsFromServer('http://localhost:8080', signal),
  api: openAICompletionsApi(),
});

models.setProvider(llamacpp);
const result = await models.refresh({ signal });
if (result.aborted) console.log('refresh cancelled');
for (const [provider, error] of result.errors) console.error(provider, error);
```

若省略 `Models.refresh()` 的可选信号参数，则该方法将无限制地执行。所有供应商始终会接收到一个具体的 `RefreshModelsContext.signal`，并**必须**在发起网络请求及其他阻塞型任务时尊重该信号。当调用方显式提供了信号时，即使某个自定义供应商未能配合，`Models.refresh()` 也会在取消后立即返回且 `aborted: true`；但该供应商仍须尊重该信号，以终止其底层工作。

可使用如下方式控制刷新行为：
- `models.refresh({ providers: ['openrouter'] })`：仅对指定供应商执行刷新；
- `models.refresh({ allowNetwork: false })`：在不访问网络的前提下恢复已持久化的模型目录；
- `models.refresh({ force: true })`：跳过供应商的新鲜度检查（freshness checks）。

模型读取操作始终保持同步，并返回最近一次恢复或刷新所得的模型列表。

`createProvider()` 会自动处理动态发布与持久化。手动编写的 `Provider.refreshModels()` 实现将接收只读的 `context.stored` 快照，并通过 `context.publish({ persist?, update? })` 发布更新。若省略 `persist`，则保持存储不变；若传入 `ModelsStoreEntry`，则写入该条目；若传入 `persist: null`，则删除该条目。发布操作具备代际校验（generation-checking）；请将同步的内存中目录变更放入 `update` 参数中，而非在发布前直接修改状态。

自定义模型可携带 `headers`（例如用于绕过机器人检测的代理）和 `compat` 标志。`Models.getAuth(model)` 返回的认证信息中会包含这些模型级 headers；流式方法会在合并显式请求 headers 和 `transformHeaders` 之前，先将其纳入请求头中。详见 [OpenAI 兼容性设置](#openai-compatibility-settings)。

部分兼容 OpenAI 协议的服务器无法识别用于支持推理能力模型的 `developer` 角色。针对此类供应商，请将 `compat.supportsDeveloperRole` 设为 `false`，以便系统提示（system prompt）以 `system` 消息形式发送。若该服务器亦不支持 `reasoning_effort` 参数，则还需将 `compat.supportsReasoningEffort` 设为 `false`。此情形常见于 Ollama、vLLM、SGLang 等兼容 OpenAI 协议的服务器。使用模型级别的 `thinkingLevelMap` 来描述特定模型的思维控制行为。键（keys）为 PI 思维层级（`off`、`minimal`、`low`、`medium`、`high`、`xhigh`、`max`）。对于从 `off` 到 `high` 的标准层级，若未在映射中显式指定，则使用对应 provider 的默认值；而 `xhigh` 和 `max` 为可选层级，必须在映射中提供非空条目才能启用。字符串类型的值将直接发送至 provider；`null` 表示该层级不被当前模型支持；映射中可以跳过任意层级。

```typescript
const ollamaReasoningModel: Model<'openai-completions'> = {
  id: 'gpt-oss:20b',
  name: 'GPT-OSS 20B (Ollama)',
  api: 'openai-completions',
  provider: 'ollama',
  baseUrl: 'http://localhost:11434/v1',
  reasoning: true,
  input: ['text'],
  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
  contextWindow: 131072,
  maxTokens: 32000,
  thinkingLevelMap: {
    minimal: null,
    low: null,
    medium: null,
    high: 'high',
    xhigh: null,
  },
  compat: {
    supportsDeveloperRole: false,
    supportsReasoningEffort: false,
  }
};
```

### 直接调用 API 实现

API 实现模块可单独导入。每个模块均导出且仅导出 `stream` 和 `streamSimple` 两个函数，并附带该 API 完整的选项类型定义。直接调用会绕过 provider 的认证机制——需显式传入 `apiKey`：

```typescript
import { stream } from '@earendil-works/pi-ai/api/anthropic-messages';

const s = stream(claudeModel, context, {
  apiKey: process.env.ANTHROPIC_API_KEY,
  thinkingEnabled: true,
  thinkingBudgetTokens: 2048,
});
```

内置的 API 实现位于 `./api/<api-id>` 目录下：

| API id | 选项类型（Options type） |
|--------|--------------------------|
| `anthropic-messages` | `AnthropicOptions` |
| `openai-completions` | `OpenAICompletionsOptions` |
| `openai-responses` | `OpenAIResponsesOptions` |
| `openai-codex-responses` | `OpenAICodexResponsesOptions` |
| `azure-openai-responses` | `AzureOpenAIResponsesOptions` |
| `google-generative-ai` | `GoogleOptions` |
| `google-vertex` | `GoogleVertexOptions` |
| `mistral-conversations` | `MistralOptions` |
| `bedrock-converse-stream` | `BedrockOptions` |

导入某个实现模块会立即加载其对应的 SDK。`./api/<id>.lazy` 包装器（由 provider 工厂函数内部使用）则通过动态 import 分块（dynamic import chunking）机制，在运行时或打包器支持的前提下，将 SDK 加载延迟至首次请求时执行。旧版本中遗留的原始 API 子路径（如 `./anthropic`、`./google`、`./mistral`、`./openai-completions` 等）已被移除；请改用 `@earendil-works/pi-ai/api/<api-id>`。

### OpenAI 兼容性配置

`openai-completions` API 被众多 provider 以细微差异的方式实现。默认情况下，本库会基于 `baseUrl` 自动检测一小部分已知 OpenAI 兼容 provider（如 Cerebras、xAI、Chutes、DeepSeek、NVIDIA NIM、Together AI、zAi、OpenCode、Cloudflare Workers AI 等）的兼容性设置。对于自定义代理（custom proxies）或未知端点，您可通过 `compat` 字段手动覆盖这些设置。针对 `openai-responses` 模型，`compat` 字段还支持响应（Responses）专属的标志位。

```typescript
interface OpenAICompletionsCompat {
  supportsStore?: boolean;           // Whether provider supports the `store` field (default: true)
  supportsDeveloperRole?: boolean;   // Whether provider supports `developer` role vs `system` (default: true)
  supportsReasoningEffort?: boolean; // Whether provider supports `reasoning_effort` (default: true)
  supportsUsageInStreaming?: boolean; // Whether provider supports `stream_options: { include_usage: true }` (default: true)
  supportsStrictMode?: boolean;      // Whether provider supports `strict` in tool definitions (default: true)
  supportsOpenAIGrammarTools?: boolean; // Whether to emit OpenAI custom Lark/regex grammar tools; false falls back to normal function tools (default: false; the generated catalog enables it for capable models)
  sendSessionAffinityHeaders?: boolean; // Send session-affinity data from `sessionId` (default: false)
  sessionAffinityFormat?: 'openai' | 'openai-nosession' | 'openrouter'; // Format for session affinity: 'openai' uses `prompt_cache_key`, `session_id`, `x-client-request-id`, and `x-session-affinity`; 'openai-nosession' uses `prompt_cache_key`, `x-client-request-id`, and `x-session-affinity`; 'openrouter' uses `x-session-id` (default: auto-detected)
  maxTokensField?: 'max_completion_tokens' | 'max_tokens';  // Which field name to use (default: max_completion_tokens)
  requiresToolResultName?: boolean;  // Whether tool results require the `name` field (default: false)
  requiresAssistantAfterToolResult?: boolean; // Whether tool results must be followed by an assistant message (default: false)
  requiresThinkingAsText?: boolean;  // Whether thinking blocks must be converted to text (default: false)
  requiresReasoningContentOnAssistantMessages?: boolean; // Whether all replayed assistant messages must include empty reasoning_content when reasoning is enabled (default: auto-detected for DeepSeek)
  thinkingFormat?: 'openai' | 'openrouter' | 'deepseek' | 'together' | 'baseten' | 'zai' | 'qwen' | 'chat-template' | 'qwen-chat-template' | 'string-thinking' | 'ant-ling'; // Format for reasoning param: 'openai' uses reasoning_effort, 'openrouter' uses reasoning: { effort }, 'deepseek' uses thinking: { type } plus reasoning_effort when supported, 'together' uses reasoning: { enabled } plus reasoning_effort when supported, 'baseten' uses configurable chat_template_args plus reasoning_effort when supported, 'zai' uses thinking: { type }, 'qwen' uses enable_thinking, 'chat-template' uses configurable chat_template_kwargs, 'qwen-chat-template' uses chat_template_kwargs.enable_thinking and preserve_thinking, 'string-thinking' uses top-level thinking, 'ant-ling' uses reasoning: { effort } only for mapped efforts (default: openai)
  chatTemplateKwargs?: Record<string, string | number | boolean | null | { '$var': 'thinking.enabled' | 'thinking.effort'; omitWhenOff?: boolean }>; // chat_template_kwargs values; use $var for pi-controlled thinking values
  chatTemplateArgs?: Record<string, string | number | boolean | null | { '$var': 'thinking.enabled' | 'thinking.effort'; omitWhenOff?: boolean }>; // chat_template_args values for thinkingFormat: 'baseten'; use $var for pi-controlled thinking values
  cacheControlFormat?: 'anthropic';  // Anthropic-style cache_control on system prompt, last tool, and last user/assistant text content
  openRouterRouting?: OpenRouterRouting; // OpenRouter routing preferences (default: {})
  vercelGatewayRouting?: VercelGatewayRouting; // Vercel AI Gateway routing preferences (default: {})
}

interface OpenAIResponsesCompat {
  supportsDeveloperRole?: boolean;   // Whether provider supports `developer` role vs `system` (default: true)
  sessionAffinityFormat?: 'openai' | 'openai-nosession' | 'openrouter'; // Session-affinity header format: 'openai' sends `session_id` and `x-client-request-id`; 'openai-nosession' sends `x-client-request-id`; 'openrouter' sends `x-session-id`. Does not affect the `prompt_cache_key` body param (default: auto-detected)
  supportsLongCacheRetention?: boolean; // Whether provider supports `prompt_cache_retention: "24h"` (default: true)
  supportsStrictMode?: boolean;      // Whether provider supports strict JSON-schema function tools (default: false; enabled in metadata for built-in OpenAI models)
  supportsOpenAIGrammarTools?: boolean; // Whether to emit OpenAI custom Lark/regex grammar tools; false falls back to normal function tools (default: false; the generated catalog enables it for capable models)
}
```

若未设置 `compat` 字段，库将回退至基于 URL 的自动检测逻辑。若 `compat` 字段为部分设置，则未指定的字段将采用自动检测所得的默认值。此机制适用于以下场景：

- **LiteLLM 代理**：可能不支持 `store` 字段  
- **自定义推理服务器**：可能使用非标准字段名  
- **自托管端点（Self-hosted endpoints）**：功能支持情况可能不同  

## 用于测试的模拟 Provider（Faux Provider）

`fauxProvider()` 可构建一个内存中的 provider，其响应行为完全由脚本控制，专用于测试与演示：

```typescript
import {
  createModels,
  fauxAssistantMessage,
  fauxProvider,
  fauxText,
  fauxThinking,
  fauxToolCall,
} from '@earendil-works/pi-ai';

const faux = fauxProvider({
  tokensPerSecond: 50 // optional
});

const models = createModels();
models.setProvider(faux.provider);

const model = faux.getModel();
const context = {
  messages: [{ role: 'user', content: 'Summarize package.json and then call echo', timestamp: Date.now() }]
};

faux.setResponses([
  fauxAssistantMessage([
    fauxThinking('Need to inspect package metadata first.'),
    fauxToolCall('echo', { text: 'package.json' })
  ], { stopReason: 'toolUse' })
]);

const first = await models.complete(model, context, {
  sessionId: 'session-1',
  cacheRetention: 'short'
});
context.messages.push(first);

context.messages.push({
  role: 'toolResult',
  toolCallId: first.content.find((block) => block.type === 'toolCall')!.id,
  toolName: 'echo',
  content: [{ type: 'text', text: 'package.json contents here' }],
  isError: false,
  timestamp: Date.now()
});

faux.setResponses([
  fauxAssistantMessage([
    fauxThinking('Now I can summarize the tool output.'),
    fauxText('Here is the summary.')
  ])
]);

const s = models.stream(model, context);
for await (const event of s) {
  console.log(event.type);
}

// Optional: multiple faux models for model-switching tests
const multiModel = fauxProvider({
  provider: 'faux-multi',
  models: [
    { id: 'faux-fast', reasoning: false },
    { id: 'faux-thinker', reasoning: true }
  ]
});
models.setProvider(multiModel.provider);
const thinker = multiModel.getModel('faux-thinker');

console.log(thinker?.reasoning);
console.log(faux.getPendingResponseCount());
console.log(faux.state.callCount);
```

注意事项：
- 响应内容按请求发起顺序从队列中依次取出并消费。
- 若队列为空，模拟 provider 将返回一条助手错误消息，其中 `errorMessage: "No more faux responses queued"`。
- 使用 `faux.setResponses([...])` 可替换剩余队列内容；使用 `faux.appendResponses([...])` 可向队列追加更多响应。
- `faux.models` 暴露所有可用的模拟模型；`faux.getModel()` 返回第一个模型；`faux.getModel(id)` 返回指定 ID 的模型。
- 使用 `fauxAssistantMessage(...)` 可生成预设的助手回复；使用 `fauxText(...)`、`fauxThinking(...)` 和 `fauxToolCall(...)` 可构建内容块，无需手动填写底层字段。
- Token 数量估算约为每 4 个字符计作 1 个 token。当存在 `sessionId` 且 `cacheRetention` 不为 `"none"` 时，系统将自动模拟 prompt 缓存的读取与写入行为。
- 工具调用参数（tool call arguments）通过 `toolcall_delta` 类型的数据块进行增量流式传输。
- 默认情况下，每个流式数据块均在独立的微任务（microtask）中发出。可通过设置 `tokensPerSecond` 参数，以真实时间节奏控制数据块的发送速率。
- 推荐用法是：每个 handle 对应一条确定性的脚本化流程。若您需要多个彼此独立的并发流程，请为每个流程创建独立的 faux provider，并为其指定不同的 `provider` ID。

## 跨 Provider 交接（Cross-Provider Handoffs）

本库支持在同一对话中无缝切换不同 LLM provider。这使得您可在对话中途更换模型，同时完整保留上下文信息，包括思维块（thinking blocks）、工具调用（tool calls）及工具执行结果（tool results）。

当将某 provider 生成的消息发送至另一 provider 时，库会自动执行消息格式转换，以确保跨 provider 兼容性：- **用户消息和工具结果消息** 保持原样传递  
- **来自同一提供商/ API 的助手消息** 完全保留不变  
- **来自不同提供商的助手消息** 将其思考块（thinking blocks）转换为带 `<thinking>` 标签的纯文本  
- **工具调用和普通文本** 均保持原样  

```typescript
import { createModels, type Context } from '@earendil-works/pi-ai';
import { anthropicProvider } from '@earendil-works/pi-ai/providers/anthropic';
import { openaiProvider } from '@earendil-works/pi-ai/providers/openai';
import { googleProvider } from '@earendil-works/pi-ai/providers/google';

const models = createModels();
models.setProvider(anthropicProvider());
models.setProvider(openaiProvider());
models.setProvider(googleProvider());

const context: Context = { messages: [] };

// Start with Claude
const claude = models.getModel('anthropic', 'claude-sonnet-4-5')!;
context.messages.push({ role: 'user', content: 'What is 25 * 18?', timestamp: Date.now() });
context.messages.push(await models.completeSimple(claude, context, { reasoning: 'medium' }));

// Switch to GPT-5 - it will see Claude's thinking as <thinking> tagged text
const gpt5 = models.getModel('openai', 'gpt-5-mini')!;
context.messages.push({ role: 'user', content: 'Is that calculation correct?', timestamp: Date.now() });
context.messages.push(await models.complete(gpt5, context));

// Switch to Gemini
const gemini = models.getModel('google', 'gemini-2.5-flash')!;
context.messages.push({ role: 'user', content: 'What was the original question?', timestamp: Date.now() });
const geminiResponse = await models.complete(gemini, context);
```

所有提供商均可处理来自其他提供商的消息——包括文本、工具调用与结果（含图像）、已转换为带标签文本的思考块，以及包含部分内容的中止消息。这支持灵活的工作流：例如，先使用快速模型启动对话，再切换至能力更强的模型执行复杂推理，或在提供商发生故障时维持上下文连续性。

## 上下文序列化

`Context` 对象可直接通过标准 JSON 方法进行序列化与反序列化，从而轻松实现对话持久化、聊天历史记录功能，或在不同服务之间传输上下文：

```typescript
const context: Context = {
  systemPrompt: 'You are a helpful assistant.',
  messages: [
    { role: 'user', content: 'What is TypeScript?', timestamp: Date.now() }
  ]
};

const model = models.getModel('openai', 'gpt-4o-mini')!;
const response = await models.complete(model, context);
context.messages.push(response);

// Serialize the entire context
const serialized = JSON.stringify(context);

// Save to database, localStorage, file, etc.
localStorage.setItem('conversation', serialized);

// Later: deserialize and continue the conversation
const restored: Context = JSON.parse(localStorage.getItem('conversation')!);
restored.messages.push({ role: 'user', content: 'Tell me more about its type system', timestamp: Date.now() });

// Continue with any model
const newModel = models.getModel('anthropic', 'claude-3-5-haiku-20241022')!;
const continuation = await models.complete(newModel, restored);
```

模型本身也是纯粹可序列化的数据——不附带任何函数或具体实现——因此，持久化“本次对话所使用的模型”仅需一次 `JSON.stringify` 即可完成。

> **注意**：若上下文中包含图像（如“图像输入”章节所述，以 base64 编码形式存在），这些图像也将一并被序列化。

## 浏览器环境使用

该库支持浏览器环境。核心入口点及提供商工厂均为无副作用（side-effect free）模块，可干净地打包。由于浏览器中不可用环境变量，因此需显式传入 API 密钥；或者注入一个 `CredentialStore`（例如基于 `localStorage` 实现的凭证存储），让提供商的身份验证逻辑从已存储的凭据中自动解析：

```typescript
import { createModels } from '@earendil-works/pi-ai';
import { anthropicProvider } from '@earendil-works/pi-ai/providers/anthropic';

const models = createModels();
models.setProvider(anthropicProvider());

const model = models.getModel('anthropic', 'claude-3-5-haiku-20241022')!;
const response = await models.complete(model, {
  messages: [{ role: 'user', content: 'Hello!', timestamp: Date.now() }]
}, {
  apiKey: 'your-api-key'
});
```

> **安全警告**：在前端代码中暴露 API 密钥极其危险。任何人皆可提取并滥用您的密钥。此方式仅适用于内部工具或演示场景。对于生产级应用，请务必使用后端代理服务来安全保管您的 API 密钥。

浏览器兼容性说明：

- Amazon Bedrock（`bedrock-converse-stream`）**不支持**在浏览器环境中运行。它仍可能出现在模型列表中；但实际调用时将在运行时失败。  
- OAuth 登录流程仅限 Node.js 环境。它们通过打包器不可见（bundler-opaque）的动态导入方式延迟加载，因此注册一个支持 OAuth 的提供商**不会**将仅限 Node.js 的代码引入浏览器打包产物中——只有真正执行登录操作时才会触发相关代码加载。  
- 若您的 Web 应用需要通过 Bedrock 或基于 OAuth 的身份验证机制访问服务，请使用服务端代理或后端服务。

## 打包与摇树优化（Tree Shaking）

为获得更小的打包体积，请仅导入您实际需要的提供商：

```typescript
import { createModels } from '@earendil-works/pi-ai';
import { openaiProvider } from '@earendil-works/pi-ai/providers/openai';

const models = createModels();
models.setProvider(openaiProvider());
```

规则如下：

- `@earendil-works/pi-ai` 是核心入口点，**不导入**内置目录（catalogs）、提供商工厂（provider factories）或 SDK 实现。  
- `@earendil-works/pi-ai/providers/<provider>` 仅导入对应提供商的目录及其懒加载 API 封装器（lazy API wrapper）。  
- `@earendil-works/pi-ai/providers/all` 导入所有内置提供商工厂及全部目录。仅当您明确需要完整内置集合时才应使用该路径。  
- 启用代码分割（code splitting）时，各提供商 SDK 将保留在懒加载区块（lazy chunks）中，并于首次请求时加载。  
- 若未启用代码分割，打包器会将所有可达的懒加载 API 实现合并进单一主包中。此时，单提供商打包产物将仅包含该提供商的 SDK；而 `providers/all` 则会包含所有静态可见的 SDK。Bedrock 是例外：其 AWS SDK 实现是通过打包器不可见的、仅限 Node.js 的导入方式加载的。  
- 直接导入 `@earendil-works/pi-ai/api/<api-id>` 将立即加载对应 API 的实现及其 SDK。

请避免在新构建的打包型应用中使用 `@earendil-works/pi-ai/compat`；该模块用于兼容旧版全局 API，并会导入完整的内置目录表面（full built-in catalog surface）。

对于单文件 Node.js ESM 打包产物，某些 SDK 依赖项内部可能仍使用动态 CommonJS `require()` 调用。若您遇到类似 `Dynamic require of "child_process" is not supported` 的错误，请向打包产物中添加 Node.js `require` shim。使用 esbuild 时示例如下：

```bash
esbuild app.js --bundle --platform=node --format=esm \
  --banner:js='import { createRequire } from "module";const require = createRequire(import.meta.url);' \
  --outfile=app.bundle.js
```

此方案**仅适用于 Node.js 打包产物**，不适用于浏览器或 Cloudflare Workers 环境。

Bedrock 仅支持 Node.js 环境。可像其他提供商一样将其加入配置：

```typescript
import { createModels } from '@earendil-works/pi-ai';
import { amazonBedrockProvider } from '@earendil-works/pi-ai/providers/amazon-bedrock';

const models = createModels();
models.setProvider(amazonBedrockProvider());
```

在常规 Node.js 包使用场景及启用代码分割的打包中，Bedrock 会懒加载其 AWS SDK 实现。若需构建一个独立的单文件打包产物且必须支持 Bedrock，则需显式注册其实现模块：

```typescript
import { setBedrockProviderModule } from '@earendil-works/pi-ai/api/bedrock-converse-stream.lazy';
import { bedrockProviderModule } from '@earendil-works/pi-ai/bedrock-provider';

setBedrockProviderModule(bedrockProviderModule);
```

该显式覆盖操作会将 AWS SDK 打包进最终产物。若未执行此操作，Bedrock 的运行时模糊导入（opaque runtime import）将期望在运行时能访问到该包中对应的 Bedrock 实现文件。

### 按提供商作用域设置的环境变量覆盖

在流式选项（stream options）中传入 `env`，可将提供方（provider）配置的作用域限定到单个请求。`env` 中的值在提供方认证与配置（例如 Cloudflare 账户 ID、Azure OpenAI 设置、Vertex 项目/区域、Bedrock 设置、`PI_CACHE_RETENTION` 以及 `HTTP_PROXY`/`HTTPS_PROXY`）中，优先于进程环境变量被使用。

```typescript
const models = builtinModels();
const model = models.getModel('cloudflare-ai-gateway', 'workers-ai/@cf/moonshotai/kimi-k2.6')!;

const response = await models.complete(model, context, {
  env: {
    CLOUDFLARE_API_KEY: '...',
    CLOUDFLARE_ACCOUNT_ID: 'account-id',
    CLOUDFLARE_GATEWAY_ID: 'gateway-id'
  }
});
```

当单个进程需为每个请求使用不同的提供方设置，或不希望环境变量“泄露”至某次提供方调用时，请使用此方式。

## OAuth 提供方

多个提供方支持 OAuth 认证，而非静态 API 密钥：

- **Anthropic**（需 Claude Pro/Max 订阅）
- **OpenAI Codex**（需 ChatGPT Plus/Pro 订阅，可访问 GPT-5.x Codex 模型）
- **GitHub Copilot**（需 Copilot 订阅）
- **OpenRouter**（采用 OAuth PKCE 流程，生成用户可控的 API 密钥）

上述每个提供方均在其 `provider.auth.oauth` 属性上暴露一个 `OAuthAuth` 实例，包含三项操作：  
- `login(interaction)`：使用与提供方无关的 `AuthInteraction.prompt()` / `notify()` 协议发起登录交互，并返回凭证（credential）；  
- `refresh(credential, signal)`：在适用情况下刷新即将过期的凭证；  
- `toAuth(credential)`：从凭证派生请求所需的认证信息（例如 GitHub Copilot 的每账户基础 URL 即由此生成）。  

所有提供方的登录交互及刷新调用均携带具体的中止信号（abort signal）。刷新操作是自动进行的：`models.getAuth(providerId)` 和请求路径会在凭证存储（credential-store）加锁的前提下自动刷新已过期的令牌，从而避免并发请求或进程重复刷新。OpenRouter 的 OAuth 流程则直接返回一个永久有效的 API 密钥，因此其 `refresh` 操作为空操作（no-op）。

```typescript
import { createModels } from '@earendil-works/pi-ai';
import { anthropicProvider } from '@earendil-works/pi-ai/providers/anthropic';

const models = createModels({ credentials: myStore }); // persistent CredentialStore
models.setProvider(anthropicProvider());

// Login: Models drives the flow and persists the credential
await models.login('anthropic', 'oauth', {
  prompt: async (p) => {
    // p.type: 'text' | 'secret' | 'select' | 'manual_code'
    // manual_code prompts race a local callback server; p.signal aborts them when the server wins
    return await askUser(p.message);
  },
  notify: (event) => {
    // event.type: 'info' | 'auth_url' | 'device_code' | 'progress'
    if (event.type === 'info') {
      console.log(event.message);
      for (const link of event.links ?? []) console.log(`${link.label ?? 'More information'}: ${link.url}`);
    }
    if (event.type === 'auth_url') console.log(`Open: ${event.url}`);
    if (event.type === 'device_code') console.log(`Code: ${event.userCode} at ${event.verificationUri}`);
    if (event.type === 'progress') console.log(event.message);
  },
});

// From here on, requests resolve and refresh the token automatically
const model = models.getModel('anthropic', 'claude-sonnet-4-5')!;
await models.complete(model, context);

// Logout
await models.logout('anthropic');
```

### Vertex AI

Vertex AI 模型支持两种认证方式：Google Cloud API 密钥 或 应用默认凭据（Application Default Credentials, ADC）。其由提供方托管的 API 密钥登录流程可配置任一方式：

- **API 密钥方式**：设置环境变量 `GOOGLE_CLOUD_API_KEY`，或在调用选项中传入 `apiKey`；  
- **本地开发（ADC）**：运行命令 `gcloud auth application-default login`；  
- **CI/生产环境（ADC）**：设置环境变量 `GOOGLE_APPLICATION_CREDENTIALS`，使其指向服务账号 JSON 密钥文件路径。

使用 ADC 时，还需设置 `GOOGLE_CLOUD_PROJECT`（或 `GCLOUD_PROJECT`）和 `GOOGLE_CLOUD_LOCATION`。您也可在调用选项中直接传入 `project` / `location`。若使用 `GOOGLE_CLOUD_API_KEY`，则无需提供 `project` 和 `location`。

```bash
# Local (uses your user credentials)
gcloud auth application-default login
export GOOGLE_CLOUD_PROJECT="my-project"
export GOOGLE_CLOUD_LOCATION="us-central1"

# CI/Production (service account key file)
export GOOGLE_APPLICATION_CREDENTIALS="/path/to/service-account.json"
```

官方文档：[应用默认凭据（Application Default Credentials）](https://cloud.google.com/docs/authentication/application-default-credentials)

### 命令行登录（CLI Login）

最快捷的身份验证方式：

```bash
npx @earendil-works/pi-ai login              # interactive provider selection
npx @earendil-works/pi-ai login anthropic    # login to specific provider
npx @earendil-works/pi-ai list               # list available providers
```

凭证将保存至当前目录下的 `auth.json` 文件中。

### 编程式 OAuth（Programmatic OAuth）

内置的登录与刷新流程属于各提供方私有实现。请使用提供方专属的 `OAuthAuth` 接口，该接口可与 `CredentialStore` 组合使用，并通过 `Models` 实现自动加锁刷新。`@earendil-works/pi-ai/oauth` 入口点仅保留编码代理（coding-agent）扩展所需 OAuth 兼容性的类型声明。

各提供方注意事项：

**OpenAI Codex**：需具备 ChatGPT Plus 或 Pro 订阅资格。可访问 GPT-5.x Codex 系列模型，具备扩展上下文窗口与更强推理能力。当流式选项中提供了 `sessionId` 且未将 `cacheRetention` 显式设为 `"none"` 时，库将自动启用基于会话的提示缓存（session-based prompt caching）。您可在流式选项中设置 `transport` 字段，取值为 `"sse"`、`"websocket"` 或 `"auto"`，以指定 Codex 响应的传输方式。当使用 WebSocket 并启用 `sessionId` 及缓存保留功能时，连接将按会话复用，且在 5 分钟无活动后自动失效。

**Azure OpenAI（Responses API）**：仅支持 Responses API。需设置 `AZURE_OPENAI_API_KEY`，并同时设置 `AZURE_OPENAI_BASE_URL` 或 `AZURE_OPENAI_RESOURCE_NAME`。`AZURE_OPENAI_BASE_URL` 支持两种格式：`https://<resource>.openai.azure.com` 与 `https://<resource>.cognitiveservices.azure.com`；根端点将自动规范化为 `.../openai/v1`。如需覆盖 API 版本，可通过 `AZURE_OPENAI_API_VERSION` 设置（默认值为 `v1`）。默认情况下，部署名称（deployment name）即被视为模型 ID；如需覆盖，可使用 `azureDeploymentName` 选项或环境变量 `AZURE_OPENAI_DEPLOYMENT_NAME_MAP`，后者接受逗号分隔的 `model-id=deployment` 键值对（例如：`gpt-4o-mini=my-deployment,gpt-4o=prod`）。旧版基于部署的 URL 格式被有意弃用，不予支持。

**GitHub Copilot**：若收到错误提示 “The requested model is not supported”（所请求的模型不受支持），请在 VS Code 中手动启用该模型：打开 Copilot Chat，点击模型选择器，选中目标模型（带警告图标），然后点击 “Enable”（启用）。

## 从旧版全局 API 迁移

旧版本暴露了一个全局 API：通过全局注册表基于 `model.api` 分发的 `stream()` / `complete()`；同步读取目录的 `getModel()` / `getModels()` / `getProviders()`；`registerApiProvider()`；`getEnvApiKey()`；以及针对各 API 的惰性流函数。该 API 表面保持不变，位于 **兼容性入口（compat entrypoint）** 中：

```typescript
// Before
import { getModel, complete } from '@earendil-works/pi-ai';

// After (verbatim behavior, one import-path change)
import { getModel, complete } from '@earendil-works/pi-ai/compat';
```

Compat 是根入口（root entrypoint）的严格超集，因此一个文件可整体切换其导入路径。该入口将在未来版本中被移除；请迁移至 `createModels()` + 提供商工厂（provider factories）：

| 旧方式 | 新方式 |
|--------|--------|
| `getModel('openai', 'gpt-4o-mini')` | `models.getModel('openai', 'gpt-4o-mini')` 或从 `providers/all` 导入的 `getBuiltinModel()` |
| `getModels('anthropic')` / `getProviders()` | `models.getModels('anthropic')` / `models.getProviders()` 或 `getBuiltin*` 系列函数 |
| `stream(model, ctx, opts)`（自动注入环境变量密钥） | `models.stream(model, ctx, opts)`（由提供商解析认证信息） |
| `registerApiProvider({ api, stream, streamSimple })` | `createProvider({ id, auth, models, api })` + `models.setProvider()` |
| `getEnvApiKey('openai')` | `await models.getAuth(model.provider)` |
| `streamAnthropic(model, ctx, opts)` | 来自 `@earendil-works/pi-ai/api/anthropic-messages` 的 `stream`，或来自某个集合（collection）中的提供商 |
| `registerFauxProvider()` | `fauxProvider()` + `models.setProvider()` |

## 开发

### 添加新提供商（Provider）

添加一个新的大语言模型（LLM）提供商需修改多个文件。项目采用分层结构：API 实现位于 `src/api/` 目录下，提供商工厂位于 `src/providers/` 目录下，稳定生成的目录包装器位于 `src/providers/<id>.models.ts`，而 `src/models.generated.ts` 负责注册它们。以下清单涵盖所有必需步骤：

#### 1. 核心类型定义（`src/types.ts`）

- 若为新增 API，需将 API 标识符加入 `KnownApi`（例如 `"bedrock-converse-stream"`）
- 将提供商名称加入 `KnownProvider`（例如 `"amazon-bedrock"`）
- 将选项类型加入 `ApiOptionsMap`

#### 2. API 实现（`src/api/<api-id>.ts`，仅适用于新增 API）

新建一个 API 实现文件（例如 `bedrock-converse-stream.ts`），该文件必须导出且仅导出 `stream` 和 `streamSimple` 两个函数，并包含以下内容：

- 一个扩展自 `StreamOptions` 的选项接口（例如 `BedrockOptions`）
- 消息转换函数，用于将 `Context` 转换为该提供商所需的格式
- 若该提供商支持工具（tools），则需提供工具转换逻辑
- 响应解析逻辑，以发出标准化事件（`text`、`tool_call`、`thinking`、`usage`、`stop`）

为便于提供商在不引入其 SDK 的前提下引用该实现，请额外创建一个惰性包装文件 `src/api/<api-id>.lazy.ts`（通过 `lazyApi()` 导出 `<name>Api()`）。若某些顶层 `export type` 需持续对外暴露（即仍可通过 `@earendil-works/pi-ai` 访问），请在 `src/index.ts` 中进行相应重新导出。

#### 3. 模型生成（`scripts/generate-models.ts`、`scripts/generate-image-models.ts`）

- 添加逻辑，用于从提供商的数据源（例如 models.dev API）获取并解析模型列表
- 在 `scripts/generate-models.ts` 中，将聊天/工具能力相关的提供商模型数据映射至标准化的 `Model` 接口；其中“hydration”机制会按 API 对 `src/providers/data/<id>.json` 中被忽略的值进行分组，而稳定的 `src/providers/<id>.models.ts` 包装器则直接依据这些 JSON 键精确推导模型/API 类型
- 在 `scripts/generate-image-models.ts` 中，将图像生成类提供商的模型数据映射至标准化的 `ImagesModel` 接口
- 处理提供商特有的异常情况（如定价格式、能力标志位、模型 ID 转换规则等）

#### 4. 提供商工厂（`src/providers/<id>.ts`）

- `createProvider()`：整合目录、认证逻辑与惰性 API 包装器
- 认证方式：
  - 对标准密钥类提供商使用 `envApiKeyAuth`
  - 对环境感知型认证（如 AWS 配置文件、ADC）使用自定义 `ApiKeyAuth`
  - 对存在 OAuth 流程的场景使用 `lazyOAuth`
- 将该工厂注册至 `src/providers/all.ts`
- 若为新增 API：还需将其注册至 `src/compat.ts` 中的内置列表，并在 `package.json` 中添加对应的包子路径导出（package subpath export）

#### 5. 测试（`test/`）

创建或更新测试文件，以覆盖新提供商的所有功能：- `stream.test.ts` — 基础流式响应与工具调用  
- `tokens.test.ts` — Token 使用量上报  
- `abort.test.ts` — 请求取消  
- `empty.test.ts` — 空消息处理  
- `context-overflow.test.ts` — 上下文长度限制错误  
- `image-limits.test.ts` — 图像支持（如适用）  
- `unicode-surrogate.test.ts` — Unicode 处理  
- `tool-call-without-result.test.ts` — 孤立的工具调用（无返回结果）  
- `image-tool-result.test.ts` — 工具返回结果中包含图像  
- `total-tokens.test.ts` — Token 计数准确性  
- `cross-provider-handoff.test.ts` — 跨提供商上下文重放  
- `providers.test.ts` — 提供商列表及认证解析  

对于 `cross-provider-handoff.test.ts`，至少添加一个提供商/模型组合。若该提供商支持多个模型系列（例如 GPT 和 Claude），则每个系列至少添加一个组合。

对于采用非标准认证方式的提供商（如 AWS、Google Vertex），需创建类似 `bedrock-utils.ts` 的工具文件，并提供凭证检测辅助函数。

#### 6. 编码智能体集成（`../coding-agent/`）

更新 `src/core/model-resolver.ts`：  
- 在 `DEFAULT_MODELS` 中为该提供商添加默认模型 ID  

更新 `src/cli/args.ts`：  
- 在帮助文本中补充环境变量说明  

更新 `README.md`：  
- 在“支持的提供商”章节中添加该提供商，并附上配置说明  

#### 7. 文档  

更新 `packages/ai/README.md`：  
- 在“支持的提供商”表格中添加该提供商  
- 记录任何该提供商特有的配置选项或认证要求  
- 在“环境变量”章节中添加对应环境变量  

#### 8. 更新日志  

在 `packages/ai/CHANGELOG.md` 文件的 `## [Unreleased]` 小节下新增一条条目：  
```markdown
### Added
- Added support for [Provider Name] provider ([#PR](link) by [@author](link))
```
  
## 许可证  

MIT
