# @earendil-works/pi-protocol

面向实验性 pi 协议的运行时无关 schema、类型、CBOR 编码，以及字节流分帧。

协议版本 `1` 使用如下线路布局的二进制消息：

1. 四字节无符号大端（big-endian）负载长度。
2. 一个定长 CBOR 项，包含消息。

客户端的第一条消息始终是 `hello`，其中包含 `PROTOCOL_VERSION`。后续消息使用关联的 request/response 信封以及服务器事件信封。会话与服务器快照具有权威性。进度事件是瞬时 UI 提示，不得折叠进权威状态。传输层须在交换协议字节之前完成认证。

会话列表包含 `SessionMetadata`，即无需获取会话运行时即可得到的规范化持久元数据。只有 `id` 和 `createdAt` 是必需的；当后端存储支持时，可包含 `updatedAt`、`parentSessionId`、`sessionName` 和 `cwd`。phase、model、thinking level、attachment、locking 等运行时状态只出现在已获取的 `SessionSnapshot` 中。

## 经过校验的消息 API

`encodeClientMessage()` 和 `encodeServerMessage()` 会校验消息并返回完整分帧的 `Uint8Array`。增量解码器接受任意分片或合并，因此可用于流、套接字和自定义字节传输。

```ts
import {
  PROTOCOL_VERSION,
  createServerMessageDecoder,
  encodeClientMessage,
  type ClientHello,
} from "@earendil-works/pi-protocol";

const hello: ClientHello = {
  type: "hello",
  version: PROTOCOL_VERSION,
};

transport.send(encodeClientMessage(hello));

const decoder = createServerMessageDecoder({ maxFrameLength: 1024 * 1024 });
for (const message of decoder.push(incomingChunk)) {
  handleServerMessage(message);
}
decoder.end(); // 在字节流关闭时调用，以检测截断。
```

也可以直接使用 `ClientMessageDecoder` 和 `ServerMessageDecoder`。schema 违规、畸形 CBOR 和无效分帧会抛出 `ProtocolValidationError`。校验错误不会保留被拒绝的负载。

`parseClientMessage()` 和 `parseServerMessage()` 只校验已经解码的值。它们不会解析 JSON 字符串。

## 传输支持

每种传输都携带相同的完整字节：`[uint32-be CBOR length][CBOR payload]`。传输可以任意拆分或合并这些字节。

本包不附带传输实现。消费者需提供能保持字节顺序并报告流关闭的字节流传输。自定义传输必须处理任意的帧分片与合并。

所有传输都不可信。在将连接暴露给协议之前，请配置匹配的帧限制，并强制执行适合该传输的访问控制。Unix 套接字可以使用文件系统权限，而网络传输可以在建立连接时进行认证。

## 编码与分帧

`encodeCbor()` 和 `decodeCbor()` 实现协议严格的 RFC 8949 子集。`encodeFrame()` 和 `FrameDecoder` 独立于 schema 与 CBOR 处理分帧。

该 CBOR 子集支持：

- `null` 与布尔值
- 有限数字；整数限制在 JavaScript 安全范围内，非整数编码为 float64
- UTF-8 字符串
- `Uint8Array` 字节串
- 定长数组
- 由具有唯一字符串键的对象表示的定长 map

未定义的对象属性会被省略。值为 JSON 的协议字段会拒绝 CBOR 字节串和非普通对象。顶层 undefined、undefined 数组元素、稀疏数组、非有限或不安全数字、标签、不定长项、畸形 UTF-8、尾随数据、过深嵌套以及过大的值都会被拒绝。

默认限制为：每个 CBOR 负载/帧 16 MiB，1,000,000 个数组元素或 map 条目，以及 64 层嵌套。可通过选项配置这些限制。帧解码器会在缓冲负载字节之前校验声明的长度。

所有 schema 都会拒绝未知的对象属性。该协议是实验性的，不提供兼容性保证。
