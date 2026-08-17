# 开发

更多指南见 [AGENTS.md](https://github.com/earendil-works/pi-mono/blob/main/AGENTS.md)。

## 搭建

```bash
git clone https://github.com/earendil-works/pi-mono
cd pi-mono
npm install
npm run build
```

从源码运行：

```bash
/path/to/pi-mono/pi-test.sh
```

该脚本可从任意目录运行。Pi 会保持调用方的当前工作目录。

## Fork / 换品牌

通过 `package.json` 配置：

```json
{
  "piConfig": {
    "name": "pi",
    "configDir": ".pi"
  }
}
```

为你的 fork 修改 `name`、`configDir` 和 `bin` 字段。这会影响 CLI 横幅、配置路径与环境变量名。

## 路径解析

三种执行模式：npm 安装、独立二进制、从源码用 tsx。

**始终使用 `src/config.ts`** 解析包内资源：

```typescript
import { getPackageDir, getThemeDir } from "./config.js";
```

切勿直接用 `__dirname` 定位包内资源。

## 调试命令

`/debug`（隐藏）会写入 `~/.pi/agent/pi-debug.log`：
- 带 ANSI 码的已渲染 TUI 行
- 最近发送给 LLM 的消息

## 测试

```bash
./test.sh                         # Run non-LLM tests (no API keys needed)
npm test                          # Run all tests
npm test -- test/specific.test.ts # Run specific test
```

## 项目结构

```
packages/
  ai/           # LLM provider abstraction
  agent/        # Agent loop and message types  
  tui/          # Terminal UI components
  coding-agent/ # CLI and interactive mode
```
