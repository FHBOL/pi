# Harness v2 晋级测试矩阵

针对 `44289550a feat(agent): promote durable harness API` 所移除测试的 QA1 清单。

本文档将每个被移除的测试用例映射到以下 QA1 结果之一：

- **Covered** — 该行为已被 v4 conformance 或其他当前测试覆盖。
- **Ported** — 该用例已在 v4 API 下重写，或已迁移到 SQLite 包。
- **Inapplicable** — 旧 API、实现细节或兼容路径已被有意删除。
- **Uncovered** — 该行为可能仍被需要，但在对应的具名实现包落地前无法移植。QA 之后会再审视；实现包从设计文档派生自己的测试，不使用本矩阵。

QA1 不包含任何生产代码或测试变更。

## 摘要

| Area | Removed cases | Status |
|---|---:|---|
| Harness runtime 与 stream 行为 | 37 | 在 `AgentHarness` 仍为脚手架期间，多数按设计为 uncovered；归属于 H/L/I/C/N 包。脚手架安全的配置由 F0 覆盖。 |
| Branch query 与 corruption 行为 | 6 | 核心查询语义已覆盖；有界 SQLite 校验缺口已由 QA2 移植，剩余 JSONL corruption 缺口归属于 J3。 |
| Compaction helper 行为 | 2 | 已由当前 compaction/context 测试覆盖。 |
| Memory/SQLite v4 conformance 入口 | 3 | 已移植到 `packages/agent/test/harness/session/*` 与 `packages/session-backends/sqlite-node/test/conformance.test.ts`。 |
| Repository/backend lifecycle 与 JSONL 行为 | 38 | 多数已由 v4 conformance 或 J0–J2 覆盖；QA2 lifecycle/query 审计已解决，剩余 crash/corruption/v3 缺口归属于 J3–J5。 |
| Session aggregate/context 行为 | 17 | 已由 v4 conformance 加上当前 context 测试覆盖。 |
| SQLite search | 1 | 已移植到 SQLite 包的 search 测试；旧的扫描式 backend 不再适用。 |

## Harness runtime 与 stream 测试

已移除文件：

- `packages/agent/test/harness/agent-harness-stream.test.ts`
- `packages/agent/test/harness/agent-harness.test.ts`

此次晋级有意用 v2 脚手架替换了行为完整的遗留 harness。运行时操作方法在所属包落地前必须以 `HarnessNotImplemented` 拒绝；见 `harness-v2.md` 第 20 节的公共方法归属表。

| Removed test | Classification | Coverage / follow-up |
|---|---|---|
| snapshots stream options before provider request hooks | Uncovered | H1/H4 在 I1/I4/L3 之后：assistant request 执行必须快照 stream options 并运行 request hooks。 |
| chains provider request patches and supports deletion semantics | Uncovered | I1 + I4 负责 hook 聚合/effect adapter；H1 覆盖 run 集成。 |
| uses updated stream options for save-point snapshots without mutating the active request | Uncovered | H3/H4/H6：checkpoint/deferred configuration 行为与 tool continuation 快照。 |
| chains provider payload hooks | Uncovered | I1 + I4，然后是 H1 的 request 集成。 |
| constructs directly and exposes queue modes | Covered / Inapplicable | 直接构造已被有意替换为 `AgentHarness.create()`。队列模式的防御性配置由 `agent-harness-scaffold.test.ts`（`keeps scaffold-safe configuration as defensive copies`）覆盖。 |
| rejects waiting before shutdown is requested | Inapplicable | 遗留 shutdown API 已删除。`waitForIdle` 属于 H5，当前由 F0 脚手架测试拒绝。 |
| shuts down active work permanently and idempotently | Uncovered | H5 负责 close/abort/wait 的结算。 |
| allows a hook to request shutdown without deadlocking its operation | Uncovered | H5 在 I1/I2 之后负责来自 hooks/events 的 close/abort 结算。 |
| allows a subscriber to request shutdown without deadlocking its operation | Uncovered | H5 在 I2 之后负责被动监听器结算。 |
| does not start a provider request when shutdown occurs during before_agent_start | Uncovered | H1/H5 在 I1 之后：before-run hook 的取消/关闭行为。 |
| aborts and awaits active compaction without persisting its result | Uncovered | H5 + C1：compaction 的 abort 对账。 |
| aborts and awaits active tree navigation without moving the session leaf | Uncovered | H5 + N1：navigation 的 abort 对账。 |
| does not treat concurrent mutations as active operations | Uncovered | I3 lane mutation line 与 H4 deferred writes/configuration。 |
| awaits concurrent idle session mutations before shutdown resolves | Uncovered | I3/H5：close 前的 mutation-line 结算。 |
| shuts down an idle harness without modifying its durable session | Covered / Uncovered | F0 覆盖脚手架 `close()` 与无 record 的 create。H5 必须覆盖无写入的持久化运行时 close。 |
| drains one queued steering message at a time and emits queue updates | Uncovered | H3 queues/checkpoints/events。 |
| appends before_agent_start messages and persists them | Uncovered | H1 `before_run` 初始消息捕获。 |
| abort clears steer and follow-up queues but preserves next-turn messages | Uncovered | H5 持久化 abort 的队列排空；H3 负责队列状态。 |
| drains follow-up messages one at a time after the agent would otherwise stop | Uncovered | H3 checkpoint 结束边界上的条件分支。 |
| settles thrown hook failures with persisted assistant error messages | Uncovered | I1 hook 隔离 + H1/H2 终态失败条目。 |
| refreshes model, thinking level, resources, system prompt, and active tools at save points | Uncovered | H3/H4/H6 checkpoint 与 deferred configuration 行为。 |
| orders pending listener session writes after agent-emitted messages | Uncovered | H4 deferred writes 加上 I2 监听器投递。 |
| waitForIdle waits for external run settlement and awaited listeners | Uncovered | H5 在 I2 之后。 |
| runs tool_call and tool_result hooks through the direct loop | Uncovered | L2/L3 tool phases、I1 hooks、H6 持久化 tool 事件。 |
| passes a static application context to harness tools | Uncovered | I4 effect-context 线程与 H6 tool 执行。 |
| resolves async tool context providers for each turn snapshot | Uncovered | I4/H6。 |
| persists generated compaction usage | Uncovered | C1 手动 compaction 操作。 |
| persists hook-provided compaction usage | Uncovered | C1 配合 I1 hooks。 |
| retries transient compaction errors and emits retry events | Uncovered | C1/C3 重试与事件集成。 |
| does not retry non-retryable compaction errors | Uncovered | C1/C3。 |
| exhausts transient compaction retries after maxRetries failures | Uncovered | C1/C3。 |
| retries transient branch summary errors and emits retry events | Uncovered | N1 navigation/branch-summary 恢复与重试行为。 |
| persists generated branch summary usage | Uncovered | N1。 |
| persists hook-provided branch summary usage | Uncovered | N1 配合 I1 hooks。 |
| preserves app tool types for getters and update events | Covered / Uncovered | Getter 防御性拷贝由 F0 脚手架测试覆盖。持久化的 active-tool 选择与 update 事件属于 H4/O1。 |
| validates constructor tool names | Uncovered | H4 负责 tool registry 以及持久化 active-tool 校验。 |
| preserves app resource types for getters and update events | Covered / Uncovered | Getter 防御性拷贝由 F0 脚手架测试覆盖。Resource update 事件属于 O1/H0 事件接线。 |

## Branch query 与 corruption 测试

已移除文件：`packages/agent/test/harness/branch-query.test.ts`。

| Removed test | Classification | Coverage / follow-up |
|---|---|---|
| provides identical in-memory query semantics | Covered | v4 backend conformance：`supports bounded filtered and cursor-based queries`；memory conformance runner。 |
| rejects corrupt parent chains in array-backed readers | Covered / Inapplicable | 旧的 array-backed reader 类型已删除。v4 JSONL 等价物由 `jsonl.test.ts` 覆盖：`rejects an imported entry that references a missing parent` 覆盖缺失 parent 的重放，`rejects a lane-bound entry that does not chain to the lane leaf` 覆盖 lane-tail parent 链式约束。循环一致性对 v4 JSONL 重放不适用，因为顺序重放期间条目不能引用未来的 parent。 |
| provides identical JSONL query semantics | Covered | J1/J2 JSONL v4 storage/repository 测试加上 backend conformance 覆盖正常的有界 branch 查询。 |
| does not decode SQLite branch entries outside query bounds | Covered | 已移植到 `packages/session-backends/sqlite-node/test/branch-query.test.ts`：`does not decode entries outside bounded branch queries` 会破坏界外 payload 与 branch-cache 成员关系，证明有界读取只解码请求的行，并证明无界读取仍会拒绝损坏的链。 |
| validates SQLite entries before filtering and limiting branch results | Covered | 已移植到 `packages/session-backends/sqlite-node/test/branch-query.test.ts`：`validates entries before branch query filters and limits` 证明窗口内损坏条目会在 `type`、`customType` 与 `limit` 过滤可能将其隐藏之前就被拒绝。 |
| does not validate SQLite ancestors beyond newest-first stop bounds | Covered | 已移植到 `packages/session-backends/sqlite-node/test/branch-query.test.ts`：`does not validate ancestors beyond newest-first stop bounds` 证明 `stopAtId` 与 `stopAtType` 读取可以返回有效后缀，而无界读取仍会拒绝缺失 parent 与循环祖先损坏。 |

## Compaction helper 测试

晋级期间从 `packages/agent/test/harness/compaction.test.ts` 移除的用例。

| Removed test | Classification | Coverage / follow-up |
|---|---|---|
| falls back to firstKeptEntryId when a compaction has no retained tail | Covered | 当前 `session/context.test.ts` 覆盖空 `retainedTail` 的 context 行为；当前 compaction 测试覆盖 cut-point 与 retained-tail 准备。 |
| prepares custom and branch summary entries for summarization | Covered | 当前 `compaction.test.ts` 覆盖跨 custom、compaction 与 branch-summary 角色的 token 估算；`session/context.test.ts` 覆盖 custom 投影与 branch-summary context。 |

## v4 conformance 入口测试

已移除/重命名的文件：

- `packages/agent/test/harness/experimental/session/memory.test.ts`
- `packages/agent/test/harness/experimental/session/sqlite.test.ts`

| Removed test | Classification | Coverage / follow-up |
|---|---|---|
| experimental memory conformance dynamic cases | Ported | `packages/agent/test/harness/session/memory.test.ts` 运行当前 v4 backend conformance 套件。 |
| uses one injectable id generator across lane views | Covered | `packages/agent/test/harness/session/memory.test.ts` 保留该聚焦的 v4 memory 用例。 |
| experimental SQLite conformance dynamic cases | Ported | `packages/session-backends/sqlite-node/test/conformance.test.ts` 运行当前 v4 backend conformance 套件。 |

## Repository/backend lifecycle 与 JSONL 测试

已移除文件：

- `packages/agent/test/harness/repo.test.ts`
- `packages/agent/test/harness/session-backends.test.ts`

| Removed test | Classification | Coverage / follow-up |
|---|---|---|
| opens, deletes, and forks by metadata (memory) | Covered | v4 conformance：`creates lists and opens sessions`、`deletes sessions idempotently`、fork 用例。 |
| delegates full-session fork selection without opening the source | Inapplicable | 旧 repository 优化已删除；v4 fork 行为由 conformance 覆盖。 |
| retains the opened aggregate instead of reloading for scoped reads | Inapplicable | 旧 aggregate 缓存细节已随遗留 repository 删除。 |
| builds context from the branch storage without loading complete history | Inapplicable / Covered | 旧 branch-storage 优化已删除；v4 context 行为由 `session/context.test.ts` 覆盖。 |
| rejects repository operations and session writes after disposal | Covered / Inapplicable | v4 核心 `SessionRepo` 契约没有可 dispose 的状态，且内存/JSONL repo 不实现永久 disposal。SQLite disposal 是资源释放而非 repo 投毒；`packages/session-backends/sqlite-node/test/repository.test.ts` 在 `closes active sessions when the repository is disposed` 中覆盖剩余适用行为，证明 repository disposal 后活跃 session 写入会被拒绝。 |
| supports lexical ownership with await using | Inapplicable | 旧测试覆盖已删除内存 repository 上的永久 disposal。v4 核心 `SessionRepo` 契约没有可 dispose 的表面，且内存/JSONL repo 不实现词法所有权。SQLite `await using` 是资源清理而非 repo 投毒；活跃 session 关闭由 `packages/session-backends/sqlite-node/test/repository.test.ts` 中的 `closes active sessions when the repository is disposed` 覆盖。 |
| serializes conflicting create and fork destinations | Uncovered / J3 | 旧测试覆盖 JSONL 全 backend 对并发 create/create 与 create/fork（目标同一 id）的序列化。V4 有意移除了全局 repository 序列化，但剩余的 format-4 lifecycle/concurrency 问题是：冲突的目标创建 是否可能产生重复文件或静默覆盖；归属于 J3 lifecycle/concurrency 边界情形。 |
| encodes custom session IDs used in filenames | Covered | J2 JSONL repository lifecycle 校验文件安全 id；`jsonl.test.ts` 拒绝无效的 coding-agent 文件名。 |
| allows appends to different sessions to run concurrently | Covered | J2/v4 repository conformance 与 JSONL 并发写入测试覆盖已受理的并发写入，不再使用旧的 keyed queue。 |
| caps concurrent operations across JSONL sessions at four by default | Inapplicable | 旧 JSONL keyed-operation-queue 实现细节已删除。 |
| allows overriding the JSONL concurrency limit | Inapplicable | 旧 JSONL keyed-operation-queue 实现细节已删除。 |
| rejects invalid JSONL concurrency limits | Inapplicable | 旧 `maxConcurrentOperations` 配置已随 JSONL keyed-operation queue 删除。 |
| releases JSONL concurrency capacity after an operation fails | Inapplicable | 旧 JSONL keyed-operation-queue 实现细节已删除。 |
| serializes appends to the same session | Covered | v4 单写者/session mutation conformance 与 JSONL shared-sequence 测试。 |
| uses listing as a barrier between accepted session operations | Inapplicable | 旧测试覆盖已删除的 JSONL `KeyedOperationQueue.enqueueBarrier()` 行为。V4 JSONL 有意不在 repository 中保留已创建/已打开的 storage，也不序列化 repository 操作；`harness-v2.md` 要求调用方 await 有序依赖的操作，因此不应恢复 listing barrier。替代的序列化不变量是按已打开的 session storage，且已由 backend conformance `linearizes concurrent writes across two lanes` 加上 JSONL 特有的 `persists concurrent cross-lane writes in shared sequence order` 覆盖。 |
| waits for every accepted session operation during disposal | Inapplicable | 旧测试覆盖已删除的 JSONL 全 backend disposal 与 `KeyedOperationQueue.drain()` 行为。V4 JSONL repo 不可 dispose，也不保留已打开的 storage，因此没有需要排空的 repo 级已受理操作集合。替代的按 session append 序列化已由 backend conformance `linearizes concurrent writes across two lanes` 与 JSONL 特有的 `persists concurrent cross-lane writes in shared sequence order` 覆盖；harness close/recovery 语义由 H5/O3 负责，而非 repository disposal。 |
| waits for accepted appends before disposal and rejects later writes | Inapplicable | 旧测试覆盖已删除的 JSONL repository disposal：排空已受理的 append，进入永久 disposed 状态，然后通过既有 session 拒绝后续写入。V4 JSONL repo 不可 dispose，不保留已打开的 storage，也没有 repo 级 closed 状态。按 session 的 append 序列化仍由 backend conformance `linearizes concurrent writes across two lanes` 与 JSONL 特有的 `persists concurrent cross-lane writes in shared sequence order` 覆盖；close/drain/关闭后拒绝的语义属于 harness H5/O3，而非 `SessionRepo` disposal。 |
| parses once when opened and retains state across appends | Inapplicable | 旧 JSONL 内存 aggregate 实现细节；v4 正确性由 reopen/shared-sequence 测试覆盖。 |
| collects sessions below encoded cwd directories and lists by cwd | Covered | J2 metadata lifecycle 与 listing 测试覆盖 v4 JSONL metadata 与 cwd 过滤。 |
| fails loudly when listing a malformed session file | Uncovered | J3 负责畸形文件的 JSONL crash/corruption 行为。 |
| rejects a missing active leaf when opened | Uncovered | J3 负责 JSONL 缺失引用拒绝。SQLite 等价物已在 `repository.test.ts` 中覆盖。 |
| opens, deletes, and forks by metadata (JSONL) | Covered | J2 JSONL repo conformance。 |
| persists header metadata through create, list, and fork | Covered | J0 codec 与 J2 repository metadata 测试。 |
| repository disposal closes its owned storage | Covered / Inapplicable | 旧内存 repo disposal 不适用，因为 v4 内存/JSONL repo 不可 dispose，也不拥有返回的 session storage 生命周期。SQLite 是唯一可 dispose 的 repository，因为它拥有 DB/lease 资源；活跃 session 关闭由 `closes active sessions when the repository is disposed` 覆盖，DB 关闭行为由既有 SQLite connection lifecycle 测试覆盖。 |
| owns leaf navigation, labels, names, stats, and branch traversal | Covered | v4 conformance 覆盖 lanes、latest facts、labels、statistics 与 branch 查询。 |
| serializes concurrent appends into one parent chain | Covered | v4 conformance `linearizes concurrent writes across two lanes`；JSONL storage shared-sequence 测试。 |
| includes assistant and summary usage in statistics | Covered | v4 conformance `keeps latest-value facts and computes ledger statistics across lanes`、JSONL storage 与 SQLite repository statistics 测试。 |
| stops branch traversal at retained-tail compaction | Covered / Inapplicable | Branch-query 停止语义在 context 投影之外仍被需要，并由 backend conformance `supports bounded filtered and cursor-based queries` 通过跨 memory、JSONL 与 SQLite 的 `findEntriesOnBranch({ stopAtType: "compaction" })` 显式覆盖。Retained-tail 物化由 context 测试 `starts at the latest compaction and materializes its retained tail` 覆盖。旧的隐式 `getBranch()` auto-stop-at-retained-tail-compaction 行为不适用，因为 v4 使用显式 branch bounds 加上 context 投影。 |
| writes headers and entries and reopens the aggregate | Covered | J1/J2 JSONL storage/repository 测试。 |
| fails loudly for malformed headers and entries | Covered / J3 | J3 负责畸形物理文件行为；当前 JSONL 测试已覆盖畸形尾部/中间行。 |
| enforces entry uniqueness and does not recreate deleted files | Covered | v4 conformance 拒绝重复 id；J2 lifecycle 覆盖 delete/reopen 行为。 |
| scopes entry uniqueness to the session path | Covered | v4 repository/session 隔离 conformance。 |
| rejects non-object header metadata | Uncovered | J3/J4 应覆盖 format-4 与 v3 normalization 的畸形 JSONL header metadata。 |

## Session aggregate 与 context 测试

已移除文件：`packages/agent/test/harness/session.test.ts`。

| Removed test | Classification | Coverage / follow-up |
|---|---|---|
| appends messages and builds context in order | Covered | v4 conformance 按 parent/sequence 顺序追加条目；`session/context.test.ts` 覆盖 context 投影。 |
| reads entries forward from the requested sequence | Covered | v4 conformance `supports bounded filtered and cursor-based queries`。 |
| tracks model and thinking level changes | Covered | 当前 `compaction.test.ts` 的 built-context 用例覆盖 model/thinking 变更；R2 reducer 测试覆盖有效配置。 |
| supports branching by moving the leaf and appending a new branch | Covered | v4 conformance lane 隔离与 lane move 用例。 |
| supports moving the leaf to root | Covered | v4 conformance lane lifecycle/targets。 |
| reconstructs compaction summaries in context | Covered | `session/context.test.ts` 从最近 compaction 开始并物化 retained tail。 |
| supports moving with branch summary entries in context | Covered | `session/context.test.ts` 包含 branch summary context 行为。 |
| persists compaction usage | Covered | v4 conformance statistics 加上 JSONL/SQLite statistics 测试。 |
| persists branch summary usage | Covered | v4 conformance statistics 加上 JSONL/SQLite statistics 测试。 |
| supports custom message entries in context | Covered | `session/context.test.ts` 的 custom 投影覆盖。 |
| keeps custom entries in context entries but omits them from messages by default | Covered | `session/context.test.ts` 的 custom 投影/默认省略覆盖。 |
| projects custom entries with configured custom-entry projectors | Covered | `session/context.test.ts` 的 custom projector 覆盖。 |
| applies context entry transforms after default compaction selection | Covered | `session/context.test.ts` 的 transform-after-compaction-boundary 覆盖。 |
| normalizes session names | Covered | v4 conformance latest-value facts；JSONL metadata 测试覆盖 name metadata。 |
| supports labels and session info entries without affecting context | Covered | v4 conformance facts/labels 加上 `session/context.test.ts` 的 context 投影。 |
| rejects labels for missing entries | Covered | v4 conformance `keeps latest-value facts and computes ledger statistics across lanes` 包含缺失 label 的拒绝。 |
| persists leaf changes and appended entries through the backend | Covered | v4 conformance 跨 memory/SQLite/JSONL 的 lane moves、reopen/list/fork 用例。 |

## SQLite search 测试

从 `packages/agent/test/harness/sqlite-node.test.ts` 移除的用例。

| Removed test | Classification | Coverage / follow-up |
|---|---|---|
| searches canonical session entries by scanning | Ported / Inapplicable | Search 已移至 `packages/session-backends/sqlite-node/test/search.test.ts`，使用 FTS5。旧的扫描式 search backend 已被有意删除。 |

## 最终 QA 轮次的实现前置条件

这些包必须先落地，QA3 才能重新评估上方的 uncovered 行。它们不以本矩阵作为测试计划。

- **QA2**：已完成的 storage/query 审计与移植，覆盖有界查询的 corruption/validation 行为、repository/session disposal lifecycle、listing/disposal barriers，以及 context 投影之外的 branch-query retained-tail 语义。
- **J3**：JSONL 畸形文件、torn-tail、缺失引用，以及 lifecycle/concurrency 边界情形。
- **J4/J5**：v3 只读 normalization 与首次写入转换；包含畸形 v3/header metadata 用例。
- **I1/I2/I3/I4/L1-L3**：hook/event/mutation/effects/loop 原语覆盖，是运行时 harness 测试回归的前提。
- **H1-H8**：此前由遗留 `agent-harness*.test.ts` 覆盖的持久化 run、queue、configuration、wait/abort、tool、recovery 与 deferred-provider 运行时行为。
- **C1-C3/N1**：此前由遗留 harness compaction/branch-summary 测试覆盖的持久化 compaction 与 navigation 运行时行为。
- **O1/O2**：围绕恢复后操作路径的完整事件/watch 快照与运行时遥测。
