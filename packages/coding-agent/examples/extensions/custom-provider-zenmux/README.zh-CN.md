# ZenMux 自定义提供商扩展示例

用 ZenMux（OpenAI 兼容聚合网关）演示：**如何写一个扩展、如何注册模型提供商、如何在项目里启用它**。

ZenMux 文档：https://zenmux.ai/docs/guide/quickstart.html

## 你能学到什么

| 概念 | 本示例对应代码 |
|------|----------------|
| 扩展入口 | `export default async function (pi: ExtensionAPI)` |
| 注册提供商 | `pi.registerProvider("zenmux", { ... })` |
| 复用内置流式 API | `api: "openai-completions"`（不必自己写 SSE） |
| API Key | `apiKey: "$ZENMUX_API_KEY"` |
| 远程发现模型 | 工厂里 `fetch(https://zenmux.ai/api/v1/models)` |
| 刷新目录 | `refreshModels({ signal })` |
| 额外命令 | `pi.registerCommand("zenmux", ...)` |

更完整的文档：

- [extensions.zh-CN.md](../../../docs/extensions.zh-CN.md)
- [custom-provider.zh-CN.md](../../../docs/custom-provider.zh-CN.md)

## 快速使用

```bash
# 1. 在 https://zenmux.ai 创建 API Key
export ZENMUX_API_KEY=zm-...

# 2. 临时加载本扩展
pi -e ./packages/coding-agent/examples/extensions/custom-provider-zenmux

# 3. 交互里选模型，或命令行指定
# /model zenmux/anthropic/claude-sonnet-5
pi -e ./packages/coding-agent/examples/extensions/custom-provider-zenmux \
  --model zenmux/anthropic/claude-sonnet-5 \
  -p "Say exactly: ok"

# 4. 查看扩展自带命令
# /zenmux
```

列出已注册模型：

```bash
ZENMUX_API_KEY=zm-... pi -e ./packages/coding-agent/examples/extensions/custom-provider-zenmux --list-models | rg zenmux
```

## 如何“注册到项目”

任选其一：

### A. 项目本地自动发现（本仓库已这样做）

把扩展放到：

```text
.pi/extensions/zenmux.ts          # 单文件
# 或
.pi/extensions/zenmux/index.ts    # 目录形式
```

本仓库的 `.pi/extensions/zenmux.ts` 直接 re-export 本示例，因此在本项目里跑 `pi` 就会自动加载。

> 项目本地扩展只在项目被标记为信任后才会加载。

### B. 全局自动发现

```bash
mkdir -p ~/.pi/agent/extensions
cp -R packages/coding-agent/examples/extensions/custom-provider-zenmux \
  ~/.pi/agent/extensions/custom-provider-zenmux
```

### C. settings.json 显式路径

```json
{
  "extensions": [
    "./packages/coding-agent/examples/extensions/custom-provider-zenmux"
  ]
}
```

## 代码阅读路线（建议按顺序）

1. **扩展工厂**  
   `export default async function`：适合需要在启动前拉模型列表的场景。

2. **`registerProvider` 配置**  
   - `baseUrl`：ZenMux OpenAI 兼容根路径 `https://zenmux.ai/api/v1`  
   - `api`：告诉 pi 用哪套协议适配器  
   - `models`：首次注册的目录（会替换该 provider 下旧模型）

3. **`mapZenMuxModel`**  
   把远端 JSON 映射成 pi 的 `ProviderModelConfig`：`id/name/reasoning/input/cost/contextWindow/maxTokens/compat`。

4. **`refreshModels`**  
   与启动时发现共用同一套 `fetchZenMuxModels`；模型选择器刷新时可更新目录。

5. **`/zenmux` 命令**  
   演示 provider 扩展也可以挂 slash command，用于状态与使用提示。

## 模型 ID 怎么写

ZenMux 的 slug 本身带 `/`（如 `anthropic/claude-sonnet-5`）。  
在 pi 里完整引用是：

```text
<provider>/<modelId>
→ zenmux/anthropic/claude-sonnet-5
```

解析规则：第一个 `/` 左边是 provider，右边整段是 modelId（与 OpenRouter 相同）。

## 常见调整

- **换端点**：改 `BASE_URL`（自建代理时常见）。
- **思考参数不兼容**：改/删模型上的 `compat.thinkingFormat`（当前默认 `openrouter`）。
- **不想拉全量目录**：删掉远程 fetch，只保留 `FALLBACK_MODELS` 静态列表。
- **要 OAuth / 自定义 SSE**：参考 `custom-provider-anthropic/`、`custom-provider-gitlab-duo/`。

## 和另外两个 provider 示例的区别

| 示例 | 难度 | 侧重点 |
|------|------|--------|
| **custom-provider-zenmux**（本例） | 入门 | OpenAI 兼容 + 远程模型发现 |
| `custom-provider-gitlab-duo` | 中级 | OAuth + 多后端代理 |
| `custom-provider-anthropic` | 高级 | 手写 `streamSimple` |
