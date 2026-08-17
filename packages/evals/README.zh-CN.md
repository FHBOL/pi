# Pi evals

Pi evals 是面向行为的、由模型驱动的 Pi 工作流检查。它们将真实的 `AgentSession` 适配到 `vitest-evals`，在隔离的临时项目与 agent 目录中运行，并附加原生 Pi 会话产物。
用它们度量端到端行为，并比较提示词、工具、技能、模型或其他 harness 配置。

## 运行 evals

从仓库根目录使用默认提供商与模型运行：

```bash
npm run eval -- --provider openai --model gpt-5.6-sol
```

等价的环境变量为：

```bash
PI_PROVIDER=openai PI_MODEL=gpt-5.6-sol npm run eval
```

CLI 值优先，并成为未显式选择模型的 harness 的默认值。提供商与模型必须一起提供。当每个被执行的 harness 都自行配置模型时，运行器也允许没有默认值。
认证来自 Pi 的常规 `ModelRuntime`，包括 Pi 订阅凭证与提供商 API 密钥环境变量。

额外参数会转发给 Vitest：

```bash
npm run eval -- src/extensions.eval.ts
npm run eval -- -t "creates, reloads, and uses"
```

每次调用都会打印一个被忽略的 `.eval/` 产物目录。`runs.jsonl` 索引已完成的 harness 运行及其在 `sessions/` 下的原生 Pi 会话 JSONL 附件。这些文件可能包含提示词、响应、源代码与工具输出。

## 编写 evals

通用套件、评判器（judge）、断言与规范化追踪指引请遵循 [`vitest-evals`](https://github.com/getsentry/vitest-evals)。Pi 专用 evals 使用来自 `src/pi-harness.ts` 的 `createPiCodingAgentHarness(...)`，每个 `describeEval(...)` 套件绑定一个 harness：

```ts
import { expect } from "vitest";
import { describeEval } from "vitest-evals";
import { createPiCodingAgentHarness } from "./pi-harness.ts";

const harness = createPiCodingAgentHarness({ noTools: "all" });

describeEval("Pi smoke", { harness }, (it) => {
	it("answers a factual question", async ({ run }) => {
		const result = await run("What is the capital of France? Reply with only the city name.");
		expect(result.output).toBe("Paris");
	});
});
```

### 配置 Pi harness

`createPiCodingAgentHarness(...)` 接受：

- `name`：用于报告与比较的稳定 harness 标识。
- `model`：可选的 `{ provider, id }` 选择。会覆盖运行器的默认模型。
- `noTools`：Pi 的工具禁用配置。
- `transformSystemPrompt`：在 eval 开始前转换完整的默认提示词。
- `output`：将最终响应与 `AgentSession` 转换为 JSON 安全的领域结果。

显式选择的模型使模型比较 harness 独立于运行器默认值：

```ts
const harness = createPiCodingAgentHarness({
	name: "claude-opus-4-6",
	model: { provider: "anthropic", id: "claude-opus-4-6" },
});
```

一次 run 可接受单个提示词，或提示词与 reload 步骤的序列。当前序提示词创建或更改了 Pi 资源时，reload 步骤很有用：

```ts
const result = await run([
	{ type: "prompt", content: "Create a Pi extension." },
	{ type: "reload" },
	{ type: "prompt", content: "Use the extension." },
]);
```

### 转换 harness 输出

使用 `output` 暴露场景特定、JSON 安全的行为，而无需把该行为加入通用 Pi 适配器：

```ts
const harness = createPiCodingAgentHarness({
	output: ({ response, session }) => ({
		response,
		activeTools: session.getActiveToolNames(),
		extensionErrors: session.resourceLoader.getExtensions().errors,
	}),
});
```

在 `result.output` 上断言应用行为。在 `result.session` 上断言模型与工具追踪，可使用 `vitest-evals` 辅助函数如 `toolCalls(...)`。

### 编写比较型 eval 集

使用 `evalHarnessTable(...)` 与 Vitest 原生的 `describe.for(...)`，对多个 harness 运行相同输入。
Harness 可在提示词、工具、技能、模型或任何其他 Pi 配置上有所不同：

```ts
import { describe } from "vitest";
import { createJudge, describeEval } from "vitest-evals";
import { evalHarnessTable } from "./vitest-evals/harness-table.ts";

const TargetTaskJudge = createJudge<string, string>("TargetTaskJudge", ({ output }) => ({
	score: output === "expected result" ? 1 : 0,
}));

const harnessTable = evalHarnessTable(
	"target skill effectiveness",
	{
		baseline: withoutTargetSkillHarness,
		candidate: withTargetSkillHarness,
		repetitions: 6,
	},
);

describe.for(harnessTable)("$name repetition $repetition", ({ harness }) => {
	describeEval("target skill effectiveness", { harness, judges: [TargetTaskJudge], judgeThreshold: null }, (it) => {
		it("completes the target task", async ({ run }) => {
			await run("Complete the target task.");
		});
	});
});
```

比较型套件应使用确定性或模型驱动的评判器记录正确性，并设置 `judgeThreshold: null`。
这样低分只作为观察结果，而不会使 Vitest 调用失败。硬断言仅用于套件不变量与基础设施契约。`expect.soft(...)` 仍会使测试失败，不是评分机制。

Pi harness 在删除临时工作区之前会快照原生会话 JSONL。一个仅用于 eval 的 `afterEach` 钩子会在 reporter 运行前将该快照注册到显式的 Vitest 测试任务。

Harness 名称在 eval 集内必须稳定且唯一。分组键在可用时将重复次数与非空字符串 `input.id` 组合，否则与严格规范 JSON 输入的 SHA-256 哈希组合。对单一处理使用 `candidate`，对多个处理使用 `candidates`。每个候选只与声明的基线比较。对每个匹配的输入与重复次数，reporter 根据每次运行记录的平均评判器分数计算通过率提升（lift），将分数至少为 `1` 视为通过。Lift 是候选通过率减去基线通过率，单位为百分点。缺失的评判器分数报告为不完整观察。Token、延迟与估计成本仍作为独立的候选减基线配对差值；缺失的遥测保持不可用。若需要执行顺序随机化，请使用 Vitest 内置的序列打乱。

比较型 eval 方法论、重复策略、可信评判器与遥测解读，参见 [`skill-eval-harness`](https://github.com/adewale/skill-eval-harness/) 指引。
