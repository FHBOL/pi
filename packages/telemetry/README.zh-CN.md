# @earendil-works/pi-telemetry

面向 pi 包的厂商无关遥测契约与类型化 schema 工具。

本包提供：

- 显式的、基于回调的 `TelemetryContext` / `TelemetrySpan` 契约；
- 共享的 `NOOP_TELEMETRY_CONTEXT`；
- 参考实现 `InMemoryTelemetryContext`；
- 可序列化的 schema 定义以及由其推断出的 TypeScript 类型；
- 没有 exporter、没有全局当前 span 状态，也不依赖某个遥测后端。

应用可以使用内存参考实现，也可以为 OpenTelemetry、Sentry、日志或其他后端提供适配器。Pi 包会显式传递遥测上下文，并分别定义自己的领域 schema。

## 目录

- [安装](#安装)
- [遥测概念](#遥测概念)
- [核心 Context API](#核心-context-api)
- [适配器契约](#适配器契约)
- [No-op Context](#no-op-context)
- [内存参考适配器](#内存参考适配器)
- [适配器一致性](#适配器一致性)
- [类型化 Schema](#类型化-schema)
  - [启动与完成属性](#启动与完成属性)
- [Schema 元数据](#schema-元数据)
- [Pi 包集成](#pi-包集成)
- [安全与可移植性](#安全与可移植性)
- [API 参考](#api-参考)
- [开发](#开发)
- [许可证](#许可证)

## 安装

```bash
npm install @earendil-works/pi-telemetry
```

## 遥测概念

遥测描述程序在运行时做了什么。本包使用 spans、attributes、events、statuses 以及显式 context 来建模这些工作：

| 概念 | 通俗含义 |
|---|---|
| **Span** | 一次操作的计时记录，例如加载账户或发起 AI 请求。它在工作开始前创建，在工作结束时结束。 |
| **父子 Span** | 操作可以包含更小的操作。一个请求 span 可能包含缓存查找和数据库查询。它们共同构成一棵树，展示时间花在了哪里。 |
| **Attribute** | 附着在 span 上的命名事实，例如 `provider: "openai"`、`cache.hit: true` 或 `item_count: 12`。属性描述操作及其结果。 |
| **Event** | span 期间某个时间点上的命名事件，例如 `retry.scheduled` 或 `cache.lookup`。事件没有持续时间，可以携带自己的属性。 |
| **Status** | 操作结果：`ok` 或 `error`。错误状态可以包含错误名称和消息。 |
| **Context** | 标识新工作在 span 树中归属位置的句柄。从某个 context 启动 span，会使其成为该 context 的子 span。 |

例如，加载账户可能产生如下遥测：

```text
example.account.load                         span
├─ attributes: account.id=123, found=true   facts about the span
├─ event: example.cache.lookup              occurrence during the span
│  └─ attribute: cache.hit=false            fact about the event
└─ status: ok                               final outcome
```

Span 是诊断数据，不是业务状态。记录它不得改变账户加载是否执行、是否成功、是否失败，或是否被持久化。适配器会把这些通用概念翻译成 OpenTelemetry、Sentry、日志或其他后端所使用的对应概念。

## 核心 Context API

`TelemetryContext` 会围绕回调启动一个 span。回调收到一个 `TelemetrySpan`，它同时也是子 span 的显式父上下文。

```typescript
import {
  NOOP_TELEMETRY_CONTEXT,
  type TelemetryContext,
} from '@earendil-works/pi-telemetry';

async function loadAccount(
  accountId: string,
  telemetryContext: TelemetryContext = NOOP_TELEMETRY_CONTEXT,
) {
  return telemetryContext.startSpan(
    {
      name: 'example.account.load',
      attributes: { 'example.account.id': accountId },
    },
    async (span) => {
      const account = await readAccount(accountId);
      span.setAttributes({ 'example.account.found': account !== undefined });
      return account;
    },
  );
}
```

将回调中的 span 传给更底层的工作，以创建显式嵌套：

```typescript
return telemetryContext.startSpan({ name: 'example.parent' }, async (parentSpan) => {
  return parentSpan.startSpan({ name: 'example.child' }, async (childSpan) => {
    childSpan.addEvent('example.cache.lookup', { 'example.cache.hit': true });
    return performWork();
  });
});
```

没有公开的 `end()` 方法。`startSpan()` 负责结算，并在回调的值或 promise 结算之前保持 span 打开。对于以正常返回值表示的预期失败，请显式设置状态：

```typescript
return telemetryContext.startSpan({ name: 'example.save' }, async (span) => {
  const result = await save();
  if (!result.ok) {
    span.setStatus({
      status: 'error',
      error: { name: 'SaveError', message: result.reason },
    });
  }
  return result;
});
```

## 适配器契约

适配器实现 `TelemetryContext`，并将通用 API 桥接到其后端。它必须：

- 创建子 span，并同步地、恰好一次地调用回调；
- 保留回调的返回值与拒绝值；在同步抛出后，返回以相同值拒绝的 promise；
- 在返回的 promise 结算之前保持原生 span 打开；
- 将正常完成视为 `ok`，将 throw/reject 视为错误，除非已显式设置状态；
- 使重复的 `setStatus()` 调用采用 last-write-wins；
- 合并 `setAttributes()` 调用，后定义的值替换先前的值，并忽略 `undefined`；
- 使记录方法同步、被动且不抛出；
- 忽略结算后的调用；
- 原子地忽略失败的记录调用，抑制后端失败，并仍然恰好执行一次业务回调。

适配器可以在内部激活后端原生的环境上下文，以便自动插装；但 pi 代码始终通过 `TelemetryContext` 参数传播父级。Exporter 缓冲、刷新、采样、后端 ID 以及后端特定的上下文对象属于适配器。请使用[适配器一致性套件](#适配器一致性)检查这些可观察语义。

## No-op Context

当遥测可选时，使用 `NOOP_TELEMETRY_CONTEXT`：

```typescript
import { NOOP_TELEMETRY_CONTEXT } from '@earendil-works/pi-telemetry';

const result = await NOOP_TELEMETRY_CONTEXT.startSpan(
  { name: 'example.operation' },
  () => runOperation(),
);
```

No-op context：

- 同步调用回调；
- 保留返回值与异步拒绝，并将同步抛出转换为以相同值拒绝的 promise；
- 使用一个共享的、冻结的惰性 span，嵌套 span 也一样；
- 不检查或保留名称、属性、事件或状态。

## 内存参考适配器

`InMemoryTelemetryContext` 是与后端无关的参考实现。它适用于测试、本地诊断，以及有意希望在没有 exporter 的情况下进行进程内捕获的应用：

```typescript
import { InMemoryTelemetryContext } from '@earendil-works/pi-telemetry';

const telemetry = new InMemoryTelemetryContext();

await telemetry.startSpan(
  { name: 'example.operation', attributes: { input: 'demo' } },
  async (span) => {
    span.addEvent('example.started');
    span.setAttributes({ output_count: 3 });
  },
);

console.log(telemetry.getSpans());
```

`getSpans()` 按 span 启动顺序返回分离的快照。每个 `RecordedTelemetrySpan` 包含确定性的数字 ID、父 ID、合并后的属性、有序事件、最终状态、结算状态，以及确定性的结束序号。它不记录时间戳。

该适配器可以安全地作为普通 `TelemetryContext` 使用，但存储是无界且进程本地的。请创建新实例以隔离测试或记录范围，并且除非调用方的数据策略允许，否则不要捕获敏感属性。

## 适配器一致性

`@earendil-works/pi-telemetry/testing` 导出一套与 runner 无关、以分组用例建模的一致性套件。fixture 提供一个全新的 context，并将其后端已完成的 span 转换为规范化的 `RecordedTelemetrySpan` 快照：

```typescript
import {
  createTelemetryAdapterConformance,
  type TelemetryAdapterFixture,
} from '@earendil-works/pi-telemetry/testing';
import { describe, it } from 'vitest';

const conformance = createTelemetryAdapterConformance(async () => {
  const adapter = createMyTelemetryAdapter();
  return {
    context: adapter.context,
    getSpans: async () => adapter.normalizedSpans(),
    async [Symbol.asyncDispose]() {
      await adapter.close();
    },
  } satisfies TelemetryAdapterFixture;
});

for (const group of new Set(conformance.map((testCase) => testCase.group))) {
  describe(group, () => {
    for (const testCase of conformance.filter((candidate) => candidate.group === group)) {
      it(testCase.name, () => testCase.run());
    }
  });
}
```

该套件检查同步的单次准入、结果与拒绝的同一性、自动与显式状态、属性合并、事件顺序、结算后的惰性调用、嵌套与并发的父子关系，以及对不可读遥测负载失败的抑制。`getSpans()` 可以在返回前刷新异步 exporter。testing 子路径使用 Node 的断言 API；根遥测包仍然与运行时无关。

## 类型化 Schema

底层 span API 有意接受开放的名称和属性袋，以便适配器保持通用。领域包可以定义封闭的、可序列化的 schema，并从中推断精确的 TypeScript 类型。

```typescript
import {
  createTypedSpanStarter,
  defineTelemetrySchema,
} from '@earendil-works/pi-telemetry';

export const EXAMPLE_TELEMETRY_SCHEMA = defineTelemetrySchema({
  version: 1,
  spans: {
    'example.read': {
      description: 'Read one resource',
      parents: { kind: 'any' },
      startAttributes: {
        'example.resource': {
          type: 'string',
          required: true,
          values: ['account', 'project'],
          description: 'Resource kind',
        },
      },
      endAttributes: {
        'example.item_count': {
          type: 'number',
          description: 'Number of returned items',
        },
      },
      events: {
        'example.cache': {
          description: 'Cache lookup result',
          attributes: {
            'example.cache.hit': {
              type: 'boolean',
              required: true,
              description: 'Whether the cache contained the resource',
            },
          },
        },
      },
      status: {
        default: 'ok',
        errorWhen: 'The read throws or returns an error result',
      },
    },
  },
} as const);

const startSpan = createTypedSpanStarter(
  telemetryContext,
  [EXAMPLE_TELEMETRY_SCHEMA],
);
```

该 starter 为每个 span 暴露一个重载，并在编译期检查名称与属性。联合值名称必须在调用前收窄，以保持每个运行时名称与其属性 schema 之间的关系。其回调会收到一个绑定到同一组 schema、并以回调 span 为父级的子 starter：

```typescript
await startSpan(
  'example.read',
  { 'example.resource': 'account' },
  async (span, startChildSpan) => {
    span.addEvent('example.cache', { 'example.cache.hit': true });
    const accounts = await readAccounts();
    span.setAttributes({ 'example.item_count': accounts.length });

    await startChildSpan(
      'example.read',
      { 'example.resource': 'project' },
      async (childSpan) => {
        const projects = await readProjects();
        childSpan.setAttributes({ 'example.item_count': projects.length });
      },
    );

    return accounts;
  },
);
```

### 启动与完成属性

`startAttributes` 和 `endAttributes` 描述属性通常何时可知，而不是分离的运行时存储：

| Schema 字段 | 值如何记录 | 必需性 |
|---|---|---|
| `startAttributes` | 在创建 span 时通过类型化 starter 的 `attributes` 参数传入 | 每个定义显式设置 `required: true` 或 `false` |
| `endAttributes` | 之后通过 schema 作用域 span 的 `setAttributes()` 方法添加 | 始终可选 |

两组都会成为同一后端 span 上的普通属性。没有单独的结束属性负载或结束回调。在前面的例子中，`example.resource` 在 `example.read` 启动时已知，而 `example.item_count` 只有在 `readAccounts()` 返回后才已知：

```typescript
await startSpan(
  'example.read',
  { 'example.resource': 'account' }, // required start attribute
  async (span) => {
    const accounts = await readAccounts();
    span.setAttributes({
      'example.item_count': accounts.length, // optional completion attribute
    });
    return accounts;
  },
); // resolving the callback settles the span
```

“End” 意味着完成期增强：结束属性可以在回调处于活动状态的任意时刻设置，并且在不可用时可以省略。调用零次 `setAttributes()` 也是合法的。这对早期失败、取消，以及并非每条路径都存在的 provider 特定数据很重要。

重复的 `setAttributes()` 调用会合并到同一个属性袋中。同一键的后定义值会替换先前值，而 `undefined` 会被忽略。schema 作用域方法只接受当前 span 声明的结束属性。

属性不会结束 span。从回调返回、resolve、throw 或 reject 才控制结算；`startSpan()` 执行实际的结束操作。结算后的适配器调用是惰性的。

一个 starter 可以组合多个独立版本化的 schema：

```typescript
import { AGENT_TELEMETRY_SCHEMAS } from '@earendil-works/pi-agent-core';

const startAgentSpan = createTypedSpanStarter(
  telemetryContext,
  AGENT_TELEMETRY_SCHEMAS,
);
```

内联 schema 数组会自动保留其元组类型。单独声明的数组应使用 `as const`。数组中字面量重复的 span 名称会在编译期被拒绝；schema 不会在运行时合并、检查或保留。

由 schema 派生的类型会拒绝缺失的必需属性、未知键、无效的封闭集值、未声明的事件，以及空 schema 上的属性。结束属性始终是可选增强；类型系统不要求必须调用 `setAttributes()`。

`defineTelemetrySchema()` 是一个类型化的恒等函数。它返回普通的 JSON 可序列化数据，不执行运行时校验或父规则强制。

## Schema 元数据

支持的属性类型有：

- `string`、`number` 和 `boolean`；
- `string[]`、`number[]` 和 `boolean[]`。

属性定义支持：

- `values`：标量值的封闭集合；
- `elementValues`：数组元素的封闭集合；
- `examples`：文档示例；
- `sensitive`：标记需要特殊处理的数据；
- `cardinality`：记录预期的 `low` 或 `high` 基数。

启动属性和事件属性声明 `required`。结束属性不声明；参见[启动与完成属性](#启动与完成属性)。

父级元数据是描述性的 schema 数据：

- `{ kind: 'any' }`：根或任意调用方 span；
- `{ kind: 'root_or_external' }`：根，或 schema 之外由调用方拥有的 span；
- `{ kind: 'spans', spans: [...] }`：仅列出的 schema spans。

适配器不需要理解 schema 对象。插装辅助函数和测试使用它们，以保持发出的名称与属性一致。

## Pi 包集成

包所有权有意拆分：

- `@earendil-works/pi-telemetry` 拥有厂商无关契约、no-op 与内存参考上下文、schema 工具，以及适配器一致性套件；
- `@earendil-works/pi-ai` 在 provider 请求选项中接受并传播 `telemetryContext`，但不拥有遥测 schema；
- `@earendil-works/pi-agent-core` 拥有并导出 pi AI 请求与 harness schema、它们组合后的只读 schema 元组，以及类型化 span 辅助函数。

```typescript
import {
  AGENT_TELEMETRY_SCHEMAS,
  AI_TELEMETRY_SCHEMA,
  HARNESS_TELEMETRY_SCHEMA,
  startAiSpan,
  startHarnessSpan,
} from '@earendil-works/pi-agent-core';
```

pi schema 使用 pi 自有的 `pi.ai.*`、`pi.harness.*` 和 `pi.session.*` 名称。适配器可以将它们翻译为后端约定，而不改变发出的 pi 词汇。

## 安全与可移植性

遥测是进程本地诊断，不是持久应用状态。不要把 `TelemetryContext`、`TelemetrySpan` 或后端原生 trace 对象持久化到记录、消息、快照或延迟句柄中。

属性值有意限制为原始标量与数组。除非 schema 与数据策略明确允许，领域插装应避免 prompts、completions、工具参数或输出、文件内容、provider 负载、headers、凭据，以及自由形式的错误细节。

本包不使用 `AsyncLocalStorage` 或其他运行时特定的环境上下文 API。它适用于 Node.js、Bun、浏览器和 workers；后端适配器仍负责自身的运行时兼容性。

## API 参考

### 核心类型与值

| 导出 | 用途 |
|---|---|
| `TelemetryContext` | 启动由回调管理的子 spans |
| `TelemetrySpan` | 记录属性、事件和状态；也充当子上下文 |
| `SpanOptions` | Span 名称与可选的启动属性 |
| `SpanAttributes` / `AttributeValue` | 开放的适配器级属性袋及支持的值 |
| `SpanStatus` | 显式的 `ok` 或 `error` 状态 |
| `NOOP_TELEMETRY_CONTEXT` | 用于禁用遥测的共享被动上下文 |
| `InMemoryTelemetryContext` | 具有确定性进程本地记录的参考适配器 |
| `RecordedTelemetrySpan` | 规范化后的已捕获 span 快照 |
| `RecordedTelemetryEvent` | 规范化后的已捕获事件快照 |

### Schema 定义与推断

| 导出 | 用途 |
|---|---|
| `defineTelemetrySchema()` | 可序列化 schema 数据的类型化恒等辅助函数 |
| `createTypedSpanStarter()` | 将父上下文绑定到一个或多个 schema 词汇表 |
| `TypedSpanStarter` | 带有递归子绑定回调的精确 starter 类型 |
| `TelemetrySchemaDefinition` | 顶层 schema 形状 |
| `TelemetrySpanDefinition` | Span 元数据、父级、属性、事件和状态规则 |
| `TelemetryAttributeType` | 支持的标量与数组类型名称 |
| `TelemetryAttributeMetadata` | 描述、敏感性与基数元数据 |
| `TelemetryAttributeDefinition` | 属性类型、允许值、示例与元数据 |
| `TelemetryStartAttributeDefinition` | 带必需性的启动属性定义 |
| `TelemetryEventAttributeDefinition` | 带必需性的事件属性定义 |
| `TelemetryEventDefinition` | 事件描述与属性定义 |
| `TelemetryParentDefinition` | 开放、外部根或有限 schema 父规则 |
| `TelemetrySchemaSpanName` | 已声明 span 名称的联合 |
| `TelemetrySchemaSpanStartAttributes` | 某个 span 精确推断的启动属性 |
| `TelemetrySchemaSpanEndAttributes` | 某个 span 可选推断的结束属性 |
| `TelemetrySchemaSpanEventName` | 某个 span 声明的事件联合 |
| `TelemetrySchemaSpanEventAttributes` | 某个事件精确推断的属性 |
| `SchemaTelemetrySpan` | 限制到某个 schema span 的 span 视图 |
| `TelemetrySchemaSpanUnion` | schema 中所有 spans 的可辨识联合 |
| `InferStartAttributes` | 从启动定义推断的必需与可选值 |
| `InferOptionalAttributes` | 从结束定义推断的可选值 |
| `InferEventAttributes` | 从事件定义推断的必需与可选值 |
| `InferRequiredAndOptionalAttributes` | 带必需性定义的共享推断工具 |
| `ExactTelemetryAttributes` | 拒绝期望属性集之外的键 |

### Testing 子路径

| 导出 | 用途 |
|---|---|
| `createTelemetryAdapterConformance()` | 创建与 runner 无关的适配器一致性用例 |
| `TelemetryAdapterFixture` | 单个用例的全新上下文与规范化快照读取器 |
| `TelemetryAdapterFixtureFactory` | 创建隔离的 fixtures |
| `TelemetryAdapterConformanceCase` | 供测试 runner 执行的分组用例 |

## 开发

在本包目录中：

```bash
npm test
npm run build
```

仓库范围的类型检查、格式化、lint 和冒烟检查运行：

```bash
npm run check
```

## 许可证

MIT
