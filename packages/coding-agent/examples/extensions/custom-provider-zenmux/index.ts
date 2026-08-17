/**
 * ZenMux Custom Provider Example
 *
 * 学习目标（OpenAI 兼容网关型提供商的最小完整路径）：
 * 1. `export default async function (pi)` —— 异步扩展工厂，启动前可拉远程模型目录
 * 2. `pi.registerProvider()` —— 注册提供商 + 模型
 * 3. `api: "openai-completions"` —— 复用 pi-ai 内置 Chat Completions 流式实现
 * 4. `apiKey: "$ZENMUX_API_KEY"` —— 环境变量插值拿密钥
 * 5. `refreshModels` —— 模型选择器刷新时重新发现目录
 *
 * ZenMux 文档：https://zenmux.ai/docs/guide/quickstart.html
 *
 * 用法：
 *   export ZENMUX_API_KEY=zm-...
 *   pi -e ./packages/coding-agent/examples/extensions/custom-provider-zenmux
 *   # 然后 /model 选择 zenmux/<slug>，例如 zenmux/anthropic/claude-sonnet-5
 *
 * 本仓库项目本地已通过 `.pi/extensions/zenmux.ts` 自动加载此扩展。
 */

import type { ExtensionAPI, ProviderModelConfig } from "@earendil-works/pi-coding-agent";

const PROVIDER_ID = "zenmux";
const BASE_URL = "https://zenmux.ai/api/v1";
const MODELS_URL = `${BASE_URL}/models`;
const DEFAULT_MAX_TOKENS = 16384;

/** ZenMux GET /models 返回的条目（只声明本扩展用到的字段） */
interface ZenMuxModel {
	id: string;
	display_name?: string;
	context_length?: number;
	input_modalities?: string[];
	capabilities?: { reasoning?: boolean };
	pricings?: {
		prompt?: Array<{ value?: number }>;
		completion?: Array<{ value?: number }>;
		input_cache_read?: Array<{ value?: number }>;
		input_cache_write?: Array<{ value?: number }>;
		input_cache_write_5_min?: Array<{ value?: number }>;
	};
}

/** 远程发现失败时的兜底模型（保证扩展仍可注册、方便离线阅读代码） */
const FALLBACK_MODELS: ProviderModelConfig[] = [
	{
		id: "anthropic/claude-sonnet-5",
		name: "Claude Sonnet 5 (ZenMux)",
		reasoning: true,
		input: ["text", "image"],
		cost: { input: 2, output: 10, cacheRead: 0.2, cacheWrite: 2.5 },
		contextWindow: 1_000_000,
		maxTokens: DEFAULT_MAX_TOKENS,
		compat: { thinkingFormat: "openrouter" },
	},
	{
		id: "openai/gpt-5.5",
		name: "GPT-5.5 (ZenMux)",
		reasoning: true,
		input: ["text", "image"],
		cost: { input: 5, output: 30, cacheRead: 0.5, cacheWrite: 0 },
		contextWindow: 1_050_000,
		maxTokens: DEFAULT_MAX_TOKENS,
		compat: { thinkingFormat: "openrouter" },
	},
	{
		id: "google/gemini-3.1-pro-preview",
		name: "Gemini 3.1 Pro Preview (ZenMux)",
		reasoning: true,
		input: ["text", "image"],
		cost: { input: 2, output: 12, cacheRead: 0.2, cacheWrite: 0 },
		contextWindow: 1_048_576,
		maxTokens: DEFAULT_MAX_TOKENS,
		compat: { thinkingFormat: "openrouter" },
	},
	{
		id: "deepseek/deepseek-v4-pro",
		name: "DeepSeek V4 Pro (ZenMux)",
		reasoning: true,
		input: ["text"],
		cost: { input: 0.435, output: 0.87, cacheRead: 0.003625, cacheWrite: 0 },
		contextWindow: 1_000_000,
		maxTokens: DEFAULT_MAX_TOKENS,
		compat: { thinkingFormat: "openrouter" },
	},
	{
		id: "qwen/qwen3.8-max",
		name: "Qwen3.8-Max (ZenMux)",
		reasoning: true,
		input: ["text", "image"],
		cost: { input: 2, output: 6, cacheRead: 0.17, cacheWrite: 2.5 },
		contextWindow: 1_000_000,
		maxTokens: DEFAULT_MAX_TOKENS,
		compat: { thinkingFormat: "openrouter" },
	},
];

function firstPrice(tiers: Array<{ value?: number }> | undefined): number {
	const value = tiers?.[0]?.value;
	return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function mapZenMuxModel(model: ZenMuxModel): ProviderModelConfig {
	const contextWindow =
		typeof model.context_length === "number" && model.context_length > 0 ? model.context_length : 128_000;
	const input = (model.input_modalities ?? ["text"]).includes("image")
		? (["text", "image"] as const)
		: (["text"] as const);
	const reasoning = Boolean(model.capabilities?.reasoning);
	const pricings = model.pricings ?? {};

	return {
		id: model.id,
		name: model.display_name ?? model.id,
		reasoning,
		input: [...input],
		cost: {
			input: firstPrice(pricings.prompt),
			output: firstPrice(pricings.completion),
			cacheRead: firstPrice(pricings.input_cache_read),
			cacheWrite: firstPrice(pricings.input_cache_write) || firstPrice(pricings.input_cache_write_5_min),
		},
		contextWindow,
		maxTokens: Math.min(DEFAULT_MAX_TOKENS, contextWindow),
		// ZenMux 是聚合网关，思考参数形态接近 OpenRouter；若某模型报错可改掉或删掉 compat
		compat: reasoning ? { thinkingFormat: "openrouter" } : undefined,
	};
}

async function fetchZenMuxModels(signal?: AbortSignal): Promise<ProviderModelConfig[]> {
	const response = await fetch(MODELS_URL, {
		headers: { Accept: "application/json" },
		signal,
	});
	if (!response.ok) {
		throw new Error(`ZenMux models HTTP ${response.status}: ${await response.text()}`);
	}

	const payload = (await response.json()) as { data?: ZenMuxModel[] };
	const models = (payload.data ?? []).filter((model) => typeof model.id === "string" && model.id.length > 0);
	if (models.length === 0) {
		throw new Error("ZenMux models response contained no models");
	}
	return models.map(mapZenMuxModel);
}

export default async function (pi: ExtensionAPI) {
	// 工厂是 async：pi 会等它完成再继续启动，因此 --list-models / 交互式启动都能看到目录
	let models = FALLBACK_MODELS;
	let discoveryError: string | undefined;
	try {
		models = await fetchZenMuxModels(AbortSignal.timeout(15_000));
	} catch (error) {
		discoveryError = error instanceof Error ? error.message : String(error);
		console.error(`[zenmux] model discovery failed, using fallback catalog: ${discoveryError}`);
	}

	pi.registerProvider(PROVIDER_ID, {
		name: "ZenMux",
		baseUrl: BASE_URL,
		// $ENV 语法：与 models.json 相同，会解析 process.env.ZENMUX_API_KEY
		apiKey: "$ZENMUX_API_KEY",
		api: "openai-completions",
		models,
		// 模型选择器刷新时会调用；不 persist，每次现场拉最新目录
		async refreshModels({ signal }) {
			return fetchZenMuxModels(signal);
		},
	});

	// 可选：注册命令，演示扩展里除了 provider 还可以挂 slash command
	pi.registerCommand("zenmux", {
		description: "Show ZenMux provider status / usage hints",
		handler: async (_args, ctx) => {
			const keySet = Boolean(process.env.ZENMUX_API_KEY?.trim());
			const lines = [
				`provider: ${PROVIDER_ID}`,
				`baseUrl: ${BASE_URL}`,
				`apiKey env: ZENMUX_API_KEY (${keySet ? "set" : "missing"})`,
				`models loaded: ${models.length}${discoveryError ? " (fallback)" : ""}`,
				discoveryError ? `discovery error: ${discoveryError}` : undefined,
				"select: /model zenmux/<slug>  e.g. zenmux/anthropic/claude-sonnet-5",
				"docs: https://zenmux.ai/docs/guide/quickstart.html",
			].filter(Boolean);
			ctx.ui.notify(lines.join("\n"), keySet ? "info" : "warning");
		},
	});
}
