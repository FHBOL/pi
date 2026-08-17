# ZenMux Custom Provider Example

Minimal OpenAI-compatible custom provider using [ZenMux](https://zenmux.ai/docs/guide/quickstart.html).

Chinese learning guide: [README.zh-CN.md](./README.zh-CN.md)

## Usage

```bash
export ZENMUX_API_KEY=zm-...
pi -e ./packages/coding-agent/examples/extensions/custom-provider-zenmux
# /model zenmux/anthropic/claude-sonnet-5
```

In this repo, `.pi/extensions/zenmux.ts` re-exports the example so project-local `pi` loads it automatically.
