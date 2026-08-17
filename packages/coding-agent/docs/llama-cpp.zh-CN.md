# llama.cpp

Pi 支持 [llama.cpp](https://github.com/ggml-org/llama.cpp) 路由服务器。路由器会发现多个 GGUF 模型，并按需加载或卸载它们。

请使用带路由器支持的较新 llama.cpp 构建。按[构建说明](https://github.com/ggml-org/llama.cpp/blob/master/docs/build.md)操作，或为你的平台安装[预构建发行版](https://github.com/ggml-org/llama.cpp/releases)。

## 启动路由器

启动 `llama-server` 时不要带 `--model` 或 `-m`。传入模型会启动单模型模式，而不是路由器模式。

```bash
llama-server \
  --models-dir ~/models \
  --no-models-autoload \
  --jinja \
  --host 127.0.0.1 \
  --port 8080 \
  -ngl 999 \
  -c 32768
```

重要选项：

- `--models-dir ~/models` 发现本地 GGUF 文件。
- `--no-models-autoload` 让加载通过 `/llama` 显式进行。
- `--jinja` 启用兼容的聊天模板与工具调用。
- `-ngl 999` 尽可能多地将层卸载到 GPU。
- `-c 32768` 为每个已加载模型设置上下文窗口。省略则使用模型原生上下文，可能需要显著更多内存。

单文件模型可直接放在模型目录中。多模态与多分片模型放在单独子目录中：

```text
~/models/
├── llama-3.2-1b-Q4_K_M.gguf
├── gemma-3-4b-it-Q4_K_M/
│   ├── gemma-3-4b-it-Q4_K_M.gguf
│   └── mmproj-F16.gguf
└── large-model-Q4_K_M/
    ├── large-model-Q4_K_M-00001-of-00003.gguf
    ├── large-model-Q4_K_M-00002-of-00003.gguf
    └── large-model-Q4_K_M-00003-of-00003.gguf
```

手动添加文件后重启路由器。关于按模型的上下文大小与其他选项，参见 [llama.cpp 模型预设](https://github.com/ggml-org/llama.cpp/blob/master/tools/server/README.md#model-presets)。

## 配置 Pi

启动 Pi 并配置提供商：

```text
/login llama.cpp
```

输入路由器 URL 与可选 API key。默认 URL 为 `http://127.0.0.1:8080`。

环境变量可在不使用 `/login` 的情况下配置相同值：

```bash
export LLAMA_BASE_URL=http://127.0.0.1:8080
export LLAMA_API_KEY=optional-secret
pi
```

若服务器使用 API key，请用匹配的 `--api-key` 值启动 `llama-server`。本地访问请保持 `--host 127.0.0.1`。

## 管理模型

运行：

```text
/llama
```

- 选择未加载的模型以加载它。
- 选择已加载的模型以卸载它。
- 选择 **Download model…**，搜索 Hugging Face，然后选择仓库与量化。精确的 `owner/repository[:quant]` 值也可用。
- 加载或下载期间按 Escape 以确认取消。

Hugging Face 搜索在已设置时使用 `HF_TOKEN`，然后检查 `$HF_TOKEN_PATH`、`$HF_HOME/token`、`$XDG_CACHE_HOME/huggingface/token` 和 `~/.cache/huggingface/token`。无认证也可搜索，但速率限制更低。下载门控仓库前 Pi 会警告并链接到其访问页面。下载由 llama.cpp 服务器执行，因此当所选仓库需要访问权限时，其进程也必须具备 `HF_TOKEN`。

若其他模型已加载，Pi 会询问是先卸载它们还是保持加载。Pi 不会静默卸载模型，也从不删除模型文件。路由器可能与其他客户端共享，因此 `/llama` 始终显示路由器的当前状态。

只有已加载的模型会出现在 `/model` 中。加载模型后，运行 `/model` 为当前 Pi 会话选择它。

若路由器断开，`/llama` 会显示 **Retry** 和 **Close**。Retry 会重连并刷新模型状态，而不会重放被中断的操作。

## 故障排除

检查路由器是否可达：

```bash
curl http://127.0.0.1:8080/health
curl http://127.0.0.1:8080/models
```

- **`/llama` 中没有模型：** 检查 `--models-dir`、目录布局，并重启路由器。
- **模型未出现在 `/model` 中：** 先用 `/llama` 加载它。
- **加载失败或占用过多内存：** 降低 `-c` 或卸载另一个模型。
- **服务器不在路由器模式：** 启动时不要带 `--model`、`-m` 或 `-hf`。
