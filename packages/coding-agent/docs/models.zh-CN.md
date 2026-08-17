# 自定义模型

通过 `~/.pi/agent/models.json` 添加自定义提供商与模型（Ollama、vLLM、LM Studio、代理等）。

## 目录

- [最小示例](#最小示例)
- [完整示例](#完整示例)
- [支持的 API](#支持的-api)
- [提供商配置](#提供商配置)
- [模型配置](#模型配置)
- [覆盖内置提供商](#覆盖内置提供商)
- [按模型覆盖](#按模型覆盖)
- [Anthropic Messages 兼容性](#anthropic-messages-兼容性)
- [OpenAI 兼容性](#openai-兼容性)

## 最小示例

对于本地模型（Ollama、LM Studio、vLLM），每个模型只需 `id`：

```json
{
  "providers": {
    "ollama": {
      "baseUrl": "http://localhost:11434/v1",
      "api": "openai-completions",
      "apiKey": "ollama",
      "models": [
        { "id": "llama3.1:8b" },
        { "id": "qwen2.5-coder:7b" }
      ]
    }
  }
}
```

`apiKey` 值是占位符，因为 Ollama 会忽略它。pi 仍会将模型视为在出现在 `/model` 之前需要认证，因此无密钥的本地服务器应保留一个伪值，用 `/login` 为该提供商保存密钥，或在选择模型时传入 `--api-key`。

某些 OpenAI 兼容服务器不理解用于具备推理能力模型的 `developer` 角色。对这些提供商，将 `compat.supportsDeveloperRole` 设为 `false`，以便 pi 将系统提示作为 `system` 消息发送。若服务器也不支持 `reasoning_effort`，也将 `compat.supportsReasoningEffort` 设为 `false`。

可在提供商级别设置 `compat` 以应用于所有模型，或在模型级别覆盖特定模型。这通常适用于 Ollama、vLLM、SGLang 及类似的 OpenAI 兼容服务器。

```json
{
  "providers": {
    "ollama": {
      "baseUrl": "http://localhost:11434/v1",
      "api": "openai-completions",
      "apiKey": "ollama",
      "compat": {
        "supportsDeveloperRole": false,
        "supportsReasoningEffort": false
      },
      "models": [
        {
          "id": "gpt-oss:20b",
          "reasoning": true
        }
      ]
    }
  }
}
```

## 完整示例

需要特定值时覆盖默认值：

```json
{
  "providers": {
    "ollama": {
      "baseUrl": "http://localhost:11434/v1",
      "api": "openai-completions",
      "apiKey": "ollama",
      "models": [
        {
          "id": "llama3.1:8b",
          "name": "Llama 3.1 8B (Local)",
          "reasoning": false,
          "input": ["text"],
          "contextWindow": 128000,
          "maxTokens": 32000,
          "cost": { "input": 0, "output": 0, "cacheRead": 0, "cacheWrite": 0 }
        }
      ]
    }
  }
}
```

每次打开 `/model` 时文件会重新加载。可在会话中编辑；无需重启。

## Google AI Studio 示例

使用带 `baseUrl` 的 `google-generative-ai`，从 Google AI Studio 添加模型，包括自定义 Gemma 4 条目：

```json
{
  "providers": {
    "my-google": {
      "baseUrl": "https://generativelanguage.googleapis.com/v1beta",
      "api": "google-generative-ai",
      "apiKey": "$GEMINI_API_KEY",
      "models": [
        {
          "id": "gemma-4-31b-it",
          "name": "Gemma 4 31B",
          "input": ["text", "image"],
          "contextWindow": 262144,
          "reasoning": true
        }
      ]
    }
  }
}
```

为 `google-generative-ai` API 类型添加自定义模型时，`baseUrl` 为必需。

## 支持的 API

| API | 说明 |
|-----|-------------|
| `openai-completions` | OpenAI Chat Completions（兼容性最广） |
| `openai-responses` | OpenAI Responses API |
| `anthropic-messages` | Anthropic Messages API |
| `google-generative-ai` | Google Generative AI |

在提供商级别设置 `api`（所有模型的默认值），或在模型级别设置（按模型覆盖）。

## 提供商配置

| 字段 | 说明 |
|-------|-------------|
| `baseUrl` | API 端点 URL |
| `api` | API 类型（见上） |
| `apiKey` | 可选 API 密钥配置（见下方值解析）。当认证由 `/login`/`auth.json` 或 CLI `--api-key` 提供时可省略。 |
| `oauth` | 动态 OAuth 提供商类型。当前支持 `"radius"`；需要网关 `baseUrl`。 |
| `headers` | 自定义请求头（见下方值解析） |
| `authHeader` | 设为 `true` 以自动添加 `Authorization: Bearer <apiKey>` |
| `models` | 模型配置数组 |
| `modelOverrides` | 对该提供商上内置或扩展注册模型的按模型覆盖 |

对于带 `models` 的提供商，非内置提供商配置需要 `baseUrl`，以及在提供商或模型级别的 `api` 值。加载文件时不要求 `apiKey`：当通过 `/login`/`auth.json`、CLI `--api-key` 或提供商 `apiKey` 配置了认证后，模型才可用。若未配置认证，模型会加载但在 `/model` 与 `--list-models` 中保持不可用。

### 值解析

`apiKey` 与 `headers` 字段支持命令执行、环境插值与字面量：

- **Shell 命令：** 以 `"!command"` 开头时，将整个值作为命令执行并使用 stdout
  ```json
  "apiKey": "!security find-generic-password -ws 'anthropic'"
  "apiKey": "!op read 'op://vault/item/credential'"
  ```
- **环境插值：** `"$ENV_VAR"` 或 `"${ENV_VAR}"` 使用命名变量的值。插值可在更大的字面量内部工作。
  ```json
  "apiKey": "$MY_API_KEY"
  "apiKey": "${KEY_PREFIX}_${KEY_SUFFIX}"
  ```
  `$FOO_BAR` 是变量 `FOO_BAR`；当 `BAR` 为字面文本时使用 `${FOO}_BAR`。缺失的环境变量会使值无法解析。
- **转义：** `"$$"` 发出字面 `"$"`；`"$!"` 发出字面 `"!"` 而不触发命令执行。
  ```json
  "apiKey": "$$literal-dollar-prefix"
  "apiKey": "$!literal-bang-prefix"
  ```
- **字面值：** 直接使用。纯大写字符串如 `MY_API_KEY` 是字面量；环境变量使用 `$MY_API_KEY`。
  ```json
  "apiKey": "sk-..."
  ```

对 `models.json`，shell 命令在请求时解析。pi 有意不对任意命令应用内置 TTL、陈旧复用或恢复逻辑。不同命令需要不同的缓存与失败策略，pi 无法推断正确策略。

若你的命令缓慢、昂贵、有速率限制，或应在瞬时失败时继续使用先前值，请将其包装在自行实现所需缓存或 TTL 行为的脚本或命令中。

`/model` 可用性检查使用已配置认证的存在性，不会执行 shell 命令。

### 自定义请求头

```json
{
  "providers": {
    "custom-proxy": {
      "baseUrl": "https://proxy.example.com/v1",
      "apiKey": "$MY_API_KEY",
      "api": "anthropic-messages",
      "headers": {
        "x-portkey-api-key": "$PORTKEY_API_KEY",
        "x-secret": "!op read 'op://vault/item/secret'"
      },
      "models": [...]
    }
  }
}
```

## 模型配置

| 字段 | 必需 | 默认 | 说明 |
|-------|----------|---------|-------------|
| `id` | 是 | — | 模型标识符（传给 API） |
| `name` | 否 | `id` | 人类可读的模型标签。用于匹配（`--model` 模式），并显示为次要模型详情文本。 |
| `api` | 否 | 提供商的 `api` | 覆盖该模型的提供商 API |
| `reasoning` | 否 | `false` | 支持扩展思考 |
| `thinkingLevelMap` | 否 | 省略 | 将 pi 思考级别映射到提供商值，并标记不支持的级别（见下） |
| `input` | 否 | `["text"]` | 输入类型：`["text"]` 或 `["text", "image"]` |
| `contextWindow` | 否 | `128000` | 上下文窗口大小（token） |
| `maxTokens` | 否 | `16384` | 最大输出 token |
| `samplingParams` | 否 | 省略 | 原样合并到每个请求体的采样参数（见下） |
| `cost` | 否 | 全零 | 每百万 token 费率，可选请求范围的输入定价档位 |
| `compat` | 否 | 提供商 `compat` | 提供商兼容性覆盖。两者都设置时与提供商级 `compat` 合并。 |

成本档位提供完整的替代费率集，当总输入用量（`input + cacheRead + cacheWrite`）超过 `inputTokensAbove` 时应用于整个请求。多个档位匹配时，最高阈值胜出。

```json
{
  "cost": {
    "input": 5,
    "output": 30,
    "cacheRead": 0.5,
    "cacheWrite": 6.25,
    "tiers": [
      {
        "inputTokensAbove": 272000,
        "input": 10,
        "output": 45,
        "cacheRead": 1,
        "cacheWrite": 12.5
      }
    ]
  }
}
```

当前行为：
- `/model`、`--list-models` 与交互式页脚按模型 `id` 显示条目。
- 配置的 `name` 用于模型匹配与次要模型详情文本。它不会替换页脚/状态栏中的模型 id。

### 采样参数

`samplingParams` 是一个自由形式对象，在 pi 自身设置的字段之后原样合并到该模型的每个请求体中，因此其键优先。用它发送 pi 未建模的采样参数——包括服务器特定的参数，如 llama.cpp 的 `min_p` 或 vLLM 的 `top_k`：

```json
{
  "id": "deepseek-v4-flash",
  "samplingParams": {
    "temperature": 1.0,
    "top_p": 0.95,
    "top_k": 0,
    "min_p": 0.0
  }
}
```

仅 OpenAI 兼容 API 会应用它（`openai-completions`、`openai-responses`、`azure-openai-responses`）；其他 API 会忽略。键会覆盖 pi 的命名请求字段（例如此处的 `temperature` 键会胜过请求级 temperature），因此最好将其作为模型采样的单一真实来源。在 `modelOverrides` 中，`samplingParams` 按键与基础模型的值合并。

### 思考级别映射

在模型上使用 `thinkingLevelMap` 描述模型特定的思考控制。键为 pi 思考级别：`off`、`minimal`、`low`、`medium`、`high`、`xhigh`、`max`。映射可以有空洞；例如，模型可暴露 `high` 与 `max` 而不暴露 `xhigh`。

值为三态：

| 值 | 含义 |
|-------|---------|
| 省略 | 到 `high` 的标准级别使用提供商默认映射；扩展的 `xhigh` 与 `max` 级别不受支持 |
| 字符串 | 级别受支持，并向提供商发送该值 |
| `null` | 级别不受支持，会被隐藏/跳过/钳制掉 |

仅支持 off、high 与 max 推理的模型示例：

```json
{
  "id": "deepseek-v4-pro",
  "reasoning": true,
  "thinkingLevelMap": {
    "minimal": null,
    "low": null,
    "medium": null,
    "high": "high",
    "xhigh": null,
    "max": "max"
  }
}
```

思考无法禁用的模型示例：

```json
{
  "id": "always-thinking-model",
  "reasoning": true,
  "thinkingLevelMap": {
    "off": null
  }
}
```

迁移：使用 `compat.reasoningEffortMap` 的旧配置应将该映射移到模型级 `thinkingLevelMap`。对不应出现在 UI 中的级别使用 `null`。

## 覆盖内置提供商

在不重新定义模型的情况下，通过代理路由内置提供商：

```json
{
  "providers": {
    "anthropic": {
      "baseUrl": "https://my-proxy.example.com/v1"
    }
  }
}
```

所有内置 Anthropic 模型仍然可用。现有 OAuth 或 API 密钥认证继续有效。

要将自定义模型合并到内置提供商，请包含 `models` 数组：

```json
{
  "providers": {
    "anthropic": {
      "baseUrl": "https://my-proxy.example.com/v1",
      "apiKey": "$ANTHROPIC_API_KEY",
      "api": "anthropic-messages",
      "models": [...]
    }
  }
}
```

合并语义：
- 保留内置模型。
- 自定义模型按提供商内的 `id` 进行 upsert。
- 若自定义模型 `id` 与内置模型 `id` 匹配，自定义模型替换该内置模型。
- 若自定义模型 `id` 为新，则与内置模型一并添加。

## 按模型覆盖

使用 `modelOverrides` 自定义内置模型与匹配的扩展注册模型，而无需替换提供商的完整模型列表。

```json
{
  "providers": {
    "openrouter": {
      "modelOverrides": {
        "anthropic/claude-sonnet-4": {
          "name": "Claude Sonnet 4 (Bedrock Route)",
          "compat": {
            "openRouterRouting": {
              "only": ["amazon-bedrock"]
            }
          }
        }
      }
    }
  }
}
```

`modelOverrides` 支持每个模型的这些字段：`name`、`reasoning`、`thinkingLevelMap`、`input`、`cost`（部分）、`contextWindow`、`maxTokens`、`samplingParams`（按键合并）、`headers`、`compat`。

直接 OpenAI GPT-5.6 Sol、Terra 与 Luna 默认使用 `272000` 上下文窗口，以便请求保持在 OpenAI 短上下文定价档位内。要选择加入 OpenAI 的 1.05M 上下文窗口，为你使用的每个模型增加它：

```json
{
  "providers": {
    "openai": {
      "modelOverrides": {
        "gpt-5.6-sol": {
          "contextWindow": 1050000
        }
      }
    }
  }
}
```

覆盖会保留内置定价元数据。总输入 token 超过 272K 的请求对整个请求使用 GPT-5.6 的长上下文费率。需要时对 `gpt-5.6-terra` 或 `gpt-5.6-luna` 应用相同覆盖。

行为说明：
- `modelOverrides` 应用于内置提供商模型与匹配的扩展注册提供商模型。
- 未知模型 ID 会被忽略。
- 可将提供商级 `baseUrl`/`headers` 与 `modelOverrides` 组合。
- 覆盖 `name` 仅更改模型匹配与次要详情文本；页脚与主模型列表继续显示模型 `id`。
- 若还为提供商定义了 `models`，自定义模型在内置覆盖之后合并。具有相同 `id` 的自定义模型会替换被覆盖的内置模型条目。

## Anthropic Messages 兼容性

对使用 `api: "anthropic-messages"` 的提供商或代理，使用 `compat` 控制 Anthropic 特定的请求兼容性。

默认情况下 pi 会按工具发送 `eager_input_streaming: true`。若代理或 Anthropic 兼容后端拒绝该字段，将 `supportsEagerToolInputStreaming` 设为 `false`。Pi 将省略 `tools[].eager_input_streaming`，并改为对启用工具的请求发送旧版 `fine-grained-tool-streaming-2025-05-14` beta 头。

某些 Anthropic 模型需要自适应思考（`thinking.type: "adaptive"` 加上 `output_config.effort`），而不是旧的基于预算的思考载荷。内置模型会自动设置。对路由到这些模型的自定义提供商或别名，将 `forceAdaptiveThinking` 设为 `true`。

某些 Anthropic 兼容提供商会发出带空签名的思考块，并仍期望在重放时包含它们。仅对这些提供商将 `allowEmptySignature` 设为 `true`；真实 Anthropic 会拒绝空思考签名。

内置 Anthropic 模型在其模型元数据中启用 `supportsStrictTools`。当端点接受严格 JSON schema 工具定义时，自定义 Anthropic 兼容模型必须将其设为 `true`。

```json
{
  "providers": {
    "anthropic-proxy": {
      "baseUrl": "https://proxy.example.com",
      "api": "anthropic-messages",
      "apiKey": "$ANTHROPIC_PROXY_KEY",
      "compat": {
        "supportsEagerToolInputStreaming": false,
        "supportsLongCacheRetention": true,
        "forceAdaptiveThinking": true,
        "allowEmptySignature": true
      },
      "models": [
        {
          "id": "claude-opus-4-7",
          "reasoning": true,
          "input": ["text", "image"]
        }
      ]
    }
  }
}
```

| 字段 | 说明 |
|-------|-------------|
| `supportsEagerToolInputStreaming` | 提供商是否接受按工具的 `eager_input_streaming`。默认：`true`。设为 `false` 以省略该字段，并在启用工具的请求上使用旧版细粒度工具流式 beta 头。 |
| `supportsLongCacheRetention` | 当缓存保留为 `long` 时，提供商是否接受 Anthropic 长缓存保留（`cache_control.ttl: "1h"`）。默认：`true`。 |
| `sendSessionAffinityHeaders` | 启用缓存时是否从会话 id 发送 `x-session-affinity`。默认：对已知提供商自动检测。 |
| `supportsCacheControlOnTools` | 提供商是否接受工具定义上的 Anthropic 风格 `cache_control` 标记。默认：`true`。 |
| `forceAdaptiveThinking` | 是否为该模型发送自适应思考（`thinking.type: "adaptive"` 加上 `output_config.effort`）。内置自适应模型会自动设置。默认：`false`。 |
| `allowEmptySignature` | 是否将空思考签名重放为 `signature: ""`，而不是将思考转换为文本。默认：`false`。 |
| `supportsStrictTools` | 提供商是否接受严格 JSON schema 工具定义。默认：`false`；内置 Anthropic 模型在生成的元数据中启用它。 |

## OpenAI 兼容性

对部分兼容 OpenAI 的提供商，使用 `compat` 字段。

- 提供商级 `compat` 将该提供商下所有模型的默认值应用。
- 模型级 `compat` 覆盖该模型的提供商级值。

```json
{
  "providers": {
    "local-llm": {
      "baseUrl": "http://localhost:8080/v1",
      "api": "openai-completions",
      "compat": {
        "supportsUsageInStreaming": false,
        "maxTokensField": "max_tokens"
      },
      "models": [...]
    }
  }
}
```

| 字段 | 说明 |
|-------|-------------|
| `supportsStore` | 提供商支持 `store` 字段 |
| `supportsDeveloperRole` | 使用 `developer` 还是 `system` 角色 |
| `supportsReasoningEffort` | 支持 `reasoning_effort` 参数 |
| `supportsUsageInStreaming` | 支持 `stream_options: { include_usage: true }`（默认：`true`） |
| `supportsFinishReason` | 流式响应是否包含 `finish_reason`。为 `false` 时，pi 在流结束时推断 `stop` 或 `toolUse`。默认：`true`。 |
| `maxTokensField` | 使用 `max_completion_tokens` 或 `max_tokens` |
| `requiresToolResultName` | 在工具结果消息上包含 `name` |
| `requiresAssistantAfterToolResult` | 在工具结果之后、用户消息之前插入助手消息 |
| `requiresThinkingAsText` | 将思考块转换为纯文本 |
| `requiresReasoningContentOnAssistantMessages` | 启用推理时在所有重放的助手消息上包含空的 `reasoning_content` |
| `thinkingFormat` | 使用 `reasoning_effort`、`openrouter`、`deepseek`、`together`、`baseten`、`zai`、`qwen`、`chat-template` 或 `qwen-chat-template` 思考参数 |
| `chatTemplateKwargs` | `thinkingFormat: "chat-template"` 的 `chat_template_kwargs` 值；对 pi 控制的思考值使用 `{ "$var": "thinking.enabled" }` 或 `{ "$var": "thinking.effort" }` |
| `chatTemplateArgs` | `thinkingFormat: "baseten"` 的 `chat_template_args` 值；对 pi 控制的思考值使用 `{ "$var": "thinking.enabled" }` 或 `{ "$var": "thinking.effort" }` |
| `cacheControlFormat` | 在系统提示、最后一个工具定义，以及最后一条用户、助手或工具结果文本内容上使用 Anthropic 风格的 `cache_control` 标记。当前仅支持 `anthropic`。 |
| `sendSessionAffinityHeaders` | 对 `openai-completions`，启用缓存时从会话 id 发送会话亲和性头。默认：`false`。 |
| `sessionAffinityFormat` | 对 `openai-completions` 与 `openai-responses`，会话亲和性头格式：`openai` 发送 `session_id`/`x-client-request-id`（completions 还发送 `x-session-affinity`），`openai-nosession` 省略包含下划线的 `session_id` 头，`openrouter` 发送 `x-session-id`。不影响 `prompt_cache_key` 请求体参数。默认：自动检测。 |
| `supportsStrictMode` | 提供商是否接受严格 JSON schema 函数工具定义。默认取决于 API；内置 OpenAI 模型带有显式能力元数据。 |
| `supportsOpenAIGrammarTools` | OpenAI 兼容 API 是否发出自定义 Lark/正则语法工具。为 `false` 时，语法约束工具回退为普通函数工具。默认：`false`；内置模型目录对 OpenAI、OpenAI Codex、Azure OpenAI、GitHub Copilot、opencode 与 Cloudflare AI Gateway 上的 GPT-5+ 模型启用它。 |
| `deferredToolsMode` | 使用提供商特定的延迟工具序列化。当前仅支持 `"kimi"`，用于 Kimi 的 OpenAI 兼容 Chat Completions 格式。 |
| `supportsLongCacheRetention` | 当缓存保留为 `long` 时，提供商是否接受长缓存保留：OpenAI 提示缓存使用 `prompt_cache_retention: "24h"`，或当 `cacheControlFormat` 为 `anthropic` 时使用 `cache_control.ttl: "1h"`。默认：`true`。 |
| `openRouterRouting` | OpenRouter 提供商路由偏好。该对象在 [OpenRouter API 请求](https://openrouter.ai/docs/guides/routing/provider-selection) 的 `provider` 字段中原样发送。 |
| `vercelGatewayRouting` | 用于提供商选择的 Vercel AI Gateway 路由配置（`only`、`order`） |

`openrouter` 使用 `reasoning: { effort }`。`together` 使用 `reasoning: { enabled }`，并在启用 `supportsReasoningEffort` 时也使用 `reasoning_effort`。`qwen` 使用顶层 `enable_thinking`。对需要 `chat_template_kwargs.enable_thinking` 与 `preserve_thinking` 的本地 Qwen 兼容服务器使用 `qwen-chat-template`。对需要可配置 `chat_template_kwargs` 的 vLLM/Hugging Face chat 模板使用 `chat-template`，例如 DeepSeek V3.x 模板的 `chatTemplateKwargs: { "thinking": { "$var": "thinking.enabled" } }`。对通过 `chat_template_args` 暴露开关控制并可选支持顶层 `reasoning_effort` 的提供商，使用带 `chatTemplateArgs` 的 `thinkingFormat: "baseten"`。

`cacheControlFormat: "anthropic"` 用于通过文本内容与工具定义上的 `cache_control` 标记暴露 Anthropic 风格提示缓存的 OpenAI 兼容提供商。

示例：

```json
{
  "providers": {
    "openrouter": {
      "baseUrl": "https://openrouter.ai/api/v1",
      "apiKey": "$OPENROUTER_API_KEY",
      "api": "openai-completions",
      "models": [
        {
          "id": "openrouter/anthropic/claude-3.5-sonnet",
          "name": "OpenRouter Claude 3.5 Sonnet",
          "compat": {
            "openRouterRouting": {
              "allow_fallbacks": true,
              "require_parameters": false,
              "data_collection": "deny",
              "zdr": true,
              "enforce_distillable_text": false,
              "order": ["anthropic", "amazon-bedrock", "google-vertex"],
              "only": ["anthropic", "amazon-bedrock"],
              "ignore": ["gmicloud", "friendli"],
              "quantizations": ["fp16", "bf16"],
              "sort": {
                "by": "price",
                "partition": "model"
              },
              "max_price": {
                "prompt": 10,
                "completion": 20
              },
              "preferred_min_throughput": {
                "p50": 100,
                "p90": 50
              },
              "preferred_max_latency": {
                "p50": 1,
                "p90": 3,
                "p99": 5
              }
            }
          }
        }
      ]
    }
  }
}
```

Vercel AI Gateway 示例：

```json
{
  "providers": {
    "vercel-ai-gateway": {
      "baseUrl": "https://ai-gateway.vercel.sh/v1",
      "apiKey": "$AI_GATEWAY_API_KEY",
      "api": "openai-completions",
      "models": [
        {
          "id": "moonshotai/kimi-k2.5",
          "name": "Kimi K2.5 (Fireworks via Vercel)",
          "reasoning": true,
          "input": ["text", "image"],
          "cost": { "input": 0.6, "output": 3, "cacheRead": 0, "cacheWrite": 0 },
          "contextWindow": 262144,
          "maxTokens": 262144,
          "compat": {
            "vercelGatewayRouting": {
              "only": ["fireworks", "novita"],
              "order": ["fireworks", "novita"]
            }
          }
        }
      ]
    }
  }
}
```
