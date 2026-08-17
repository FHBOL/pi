# 容器化

Pi 默认以全部权限运行，但在某些情况下，你会希望更严格地控制 Pi 可写入的目录以及它拥有的访问权。

一般有两种选择。你可以：
1. 将整个 `pi` 进程放在隔离环境中运行，或
2. 在宿主机运行 `pi`，并将工具执行路由到隔离环境。

## 选择模式

| 模式 | 隔离内容 | 最适合 | 说明 |
| --- | --- | --- | --- |
| Gondolin 扩展 | 内置工具与 `!` 命令 | 本地微 VM 隔离，同时把认证留在宿主机 | 见 [`examples/extensions/gondolin/`](../examples/extensions/gondolin/)。 |
| 普通 Docker | 整个 `pi` 进程在本地容器中 | 简单的本地隔离 | 提供商 API 密钥会进入容器。 |
| OpenShell | 整个 `pi` 进程在策略控制的沙箱中 | 本地或远程托管沙箱 | 需要 OpenShell gateway |

扩展在 `pi` 进程所在处运行。若你在宿主机运行 `pi` 并使用工具路由扩展，其他自定义扩展工具仍在宿主机运行，除非它们也委托其操作。

## Gondolin

[Gondolin](https://github.com/earendil-works/gondolin) 是本地 Linux 微 VM。
当你希望 `pi` 在宿主机运行，但所有内置工具都路由进 VM 时，使用[示例扩展](../examples/extensions/gondolin)。

搭建：

```bash
cp -R packages/coding-agent/examples/extensions/gondolin ~/.pi/agent/extensions/gondolin
cd ~/.pi/agent/extensions/gondolin
npm install --ignore-scripts
```

从你想挂载的项目运行：

```bash
cd /path/to/project
pi -e ~/.pi/agent/extensions/gondolin
```

该扩展将宿主机 cwd 挂载到 VM 的 `/workspace`，并覆盖 `read`、`write`、`edit`、`bash`、`grep`、`find` 与 `ls`。
用户的 `!` 命令也会路由进 VM。
`/workspace` 下的文件更改会写回宿主机。

要求：`@earendil-works/gondolin` 需要 Node.js >= 23.6.0，以及 QEMU（需通过包管理器安装）。

## 普通 Docker

当你想要最简单的本地容器边界时，在 Docker 中运行整个 `pi` 进程。

`Dockerfile.pi`：

```dockerfile
FROM node:24-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends bash ca-certificates git ripgrep \
  && rm -rf /var/lib/apt/lists/*
RUN npm install -g --ignore-scripts @earendil-works/pi-coding-agent

WORKDIR /workspace
ENTRYPOINT ["pi"]
```

构建并运行：

```bash
docker build -t pi-sandbox -f Dockerfile.pi .

docker run --rm -it \
  -e ANTHROPIC_API_KEY \
  -v "$PWD:/workspace" \
  -v pi-agent-home:/root/.pi/agent \
  pi-sandbox
```

`-v "$PWD:/workspace"` 将当前目录挂载到容器内的 /workspace，因此 Docker 内对 `/workspace` 的读写会直接影响宿主机文件，与 Gondolin 示例类似。

若希望设置与会话仅存在于容器内，请为 `/root/.pi/agent` 使用命名卷。挂载宿主机 `~/.pi/agent` 会把宿主机认证与会话文件暴露给容器。

## OpenShell

当你需要带有文件系统、进程、网络、凭证与推理控制的策略沙箱时，使用 [NVIDIA OpenShell](https://docs.nvidia.com/openshell/about/overview)。
OpenShell 可通过由 Docker、Podman 或 VM 运行时支持的本地 gateway 运行沙箱，也可通过远程 Kubernetes gateway。

每个沙箱都需要一个活动的 gateway。
创建沙箱前先注册并选择一个：

```bash
openshell gateway add <gateway-url> --name <name>
openshell gateway select <name>
```

在 OpenShell 沙箱内启动 `pi`：

```bash
openshell sandbox create --name pi-sandbox --from pi -- pi
```

在此模式中，整个 `pi` 进程在沙箱内运行。
内置工具、`!` 命令与扩展工具都在 OpenShell 边界内执行。

若 gateway 是远程的，项目文件不会从宿主机绑定挂载，意味着沙箱内的写入不会反映到你的机器上。
在沙箱内克隆仓库，或使用 OpenShell 文件传输命令：

```bash
openshell sandbox upload pi-sandbox ./repo /workspace
openshell sandbox download pi-sandbox /workspace/repo ./repo-out
```

OpenShell 提供商可将原始模型 API 密钥留在沙箱外。
配置推理路由后，沙箱内的代码可调用 `https://inference.local`，gateway 会在上游注入已配置的提供商凭证。
若希望模型流量走此路由，请将 Pi 配置为使用对应的 OpenAI 兼容或 Anthropic 兼容端点。
