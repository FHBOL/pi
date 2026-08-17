# @earendil-works/pi-server

实验性。本包仍在积极开发中，可能在无另行通知的情况下变更或移除。其 API 与行为尚未稳定。

pi 的服务端包。

## 会话服务器核心

本包导出 `PiServer` 会话服务器。

```ts
import type { PiServerService } from "@earendil-works/pi-server";
import { createUnixServer } from "@earendil-works/pi-server/unix";

const service: PiServerService = {
  async listSessions() {
    return storage.listSessions();
  },
  async listModels() {
    return modelRegistry.listModels();
  },
  async createSession(options) {
    return storage.createAndOpen(options);
  },
  async openSession(sessionId) {
    return storage.open(sessionId);
  },
};

const server = createUnixServer(service, {
  path: "/tmp/pi/server.sock",
});
await server.start();
```

`PiServer` 通过 `PiServerListener` 接口组合传输层监听器。每个监听器必须完成其传输特定的认证与授权，再将连接交给 `PiServer`。例如，WebSocket 监听器可以在 HTTP 升级期间校验凭据，而 Unix 监听器依赖套接字文件系统权限。Unix 子模块导出 `createUnixListener()` 构建块和 `createUnixServer()` 预设，在不把主服务器耦合到 Unix 套接字的前提下，让常见场景更简洁。监听器使用来自 `@earendil-works/pi-protocol` 的长度前缀 CBOR 消息。

本包不提供独立 CLI 或 coding-agent 服务。应用需自行提供 `PiServerService` 实现。

`PiServerService.listSessions()` 返回协议中的 `SessionMetadata`，而不是已获取的运行时状态。服务应映射其存储所支持的持久字段，并可省略 `updatedAt`、`parentSessionId`、`sessionName` 和 `cwd`。`PiServer` 会从实时快照刷新可用元数据，而不要求已存储的会话伪造 phase、model、thinking-level、attachment 或 lock 值。

## 传输测试

自定义传输可以使用 `@earendil-works/pi-server/testing` 进行确定性的协议一致性测试。它导出 `createTestServer()`、`TestServerService`、`ProtocolTestClient`，以及与传输无关的 `WireChannel` 契约。`connectUnixTestClient()` 用于 Unix 传输测试。

## `pi-ai` 协议桥接

`@earendil-works/pi-ai` 领域对象与 `@earendil-works/pi-protocol` 线路 DTO 保持独立。本包负责它们之间的边界，并导出 `toProtocolModelMetadata()`、`toProtocolAssistantMessage()`、`toProtocolUserMessage()` 和 `toProtocolToolResultMessage()`。

这些适配器会拒绝无效的工具输入、标识符、时间戳以及不匹配的工具结果；`toProtocolToolResultMessage()` 需要原始的 `ToolCall`，以便校验关联关系并自行转换其参数。诊断细节会被显式净化。封闭的 `pi-ai` 联合类型会被穷尽映射，编译期字段清单会枚举当前的 `pi-ai` 属性，因此新增字段需要显式审查。在语义相同的地方，协议会镜像 `pi-ai` 的词汇（如 `toolCall` 和 `toolUse`）。协议 schema 强制一致的生命周期状态，测试会通过运行时 schema 编码适配器输出，以便不兼容的变更在桥接包中失败。
