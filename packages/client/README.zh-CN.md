# @earendil-works/pi-client

传输无关的远程 pi 会话客户端。`PiClient` 通过精简的 `ByteTransport` 接口交换带长度前缀的 CBOR 消息。本包不含任何 Node 专用导入。

```ts
import { PiClient, type ByteTransportFactory } from "@earendil-works/pi-client";

const transportFactory: ByteTransportFactory = async (handlers) => {
  // Connect using WebSocket, Unix socket, or another ordered byte transport.
  return {
    async send(chunk) {
      // Deliver chunks in invocation order and honor backpressure.
    },
    close() {},
  };
};

const client = new PiClient({ transportFactory });
await client.connect();
const session = await client.createSession({ cwd: "/workspace" });
const unsubscribe = session.subscribe((snapshot) => render(snapshot));
await session.prompt("Inspect this project");
unsubscribe();
```

对入站字节调用 `handlers.onData(chunk)`，对有序的终端关闭调用 `handlers.onClose()`，对传输失败调用 `handlers.onError(error)`。工厂必须为每次连接尝试创建新的传输，并在 resolve 之前完成任何传输特定的认证。例如，WebSocket 工厂可以在其升级请求中提供凭证。

`PiClient` 不会自动重连。断开后请调用 `reconnect()`。一个连接可以挂接多个会话。请求通过 ID 关联。服务器快照与成功响应快照具有权威性，而进度事件不会乐观地变更快照状态。从 `client.snapshot?.sessions` 读取缓存的会话元数据；调用 `listSessions()` 可向服务器请求刷新后的持久元数据。运行时状态在获取会话后可用。

`acquireSession()` 返回独立的 `SessionLease`；租约不能直接构造。对生命周期或变更协调使用 `{ mode: "exclusive" }`；当多个底层消费者有意共享会话时使用 `{ mode: "shared" }`。只要存在任何租约，独占获取就会以 `PiSessionOwnershipError` 失败；只要存在独占租约，共享获取就会失败。`attachSession()` 是共享获取的便捷方法。`createSession()` 为新创建的会话返回独占租约。

调用 `dispose()` 或 `detach()` 仅释放该租约。租约一旦开始释放就会拒绝命令。客户端在最后一个租约释放后发送协议 detach 请求。若显式 `detach()` 失败，租约会重新变为可用以便重试。若面向清理的 `dispose()` 失败，它会报告协议错误但放弃本地所有权；`PiClient` 会在下次获取前协调失败的协议清理。已释放的租约变为不可用，且不影响其他共享租约。服务器移除或断开连接会使受影响挂接上的所有租约失效，对已失效租约调用 dispose 是空操作。客户端断开时命令以 `PiDisconnectedError` 失败；客户端已连接但租约正在释放、已释放或已失效时以 `PiSessionDetachedError` 失败。租约实现 `AsyncDisposable`。

`subscribe()` 观察权威快照。`onEvent()` 观察协议事件。二者都返回取消订阅函数。服务器返回的结构化错误以 `PiServerError` 暴露。

## 限制与安全

`PiClientOptions.maxFrameLength` 限制入站与出站 CBOR 载荷。请在客户端与服务器上配置匹配的限制。传输应另行限制排队的出站字节并保持发送顺序。

将对端视为不可信。使用具备适当访问控制的安全传输，并在建立传输时进行认证。

订阅者异常与协议状态隔离。在 `PiClientOptions` 中设置 `onListenerError`，以便将其报告到应用日志或诊断系统。

## Unix 域套接字

Node.js 与 Bun 使用者可以使用单独导出的 Unix 域套接字传输：

```ts
import { PiClient } from "@earendil-works/pi-client";
import { createUnixTransportFactory } from "@earendil-works/pi-client/unix";

const client = new PiClient({
  transportFactory: createUnixTransportFactory({
    path: "/tmp/pi.sock",
  }),
});

await client.connect();
```

`maxPendingBytes` 限制排队的出站数据。默认值为协议帧限制的四倍。该传输保持发送顺序，并在 resolve 每次发送前等待套接字背压。

`@earendil-works/pi-client` 根入口仍保持传输与运行时无关。导入 Node 兼容传输需要使用显式的 `@earendil-works/pi-client/unix` 子路径。
