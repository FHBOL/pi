> pi 可以创建提示模板。请它为你的工作流构建一个。

# 提示模板（Prompt Templates）

提示模板是会展开为完整提示的 Markdown 片段。在编辑器中输入 `/name` 即可调用模板，其中 `name` 是不含 `.md` 的文件名。

## 位置

Pi 从以下位置加载提示模板：

- 全局：`~/.pi/agent/prompts/*.md`
- 项目：`.pi/prompts/*.md`（仅在项目受信任后）
- 包：`prompts/` 目录或 `package.json` 中的 `pi.prompts` 条目
- 设置：`prompts` 数组，包含文件或目录
- CLI：`--prompt-template <path>`（可重复）

用 `--no-prompt-templates` 禁用发现。

## 格式

```markdown
---
description: Review staged git changes
---
Review the staged changes (`git diff --cached`). Focus on:
- Bugs and logic errors
- Security issues
- Error handling gaps
```

- 文件名成为命令名。`review.md` 变成 `/review`。
- `description` 可选。若缺失，使用第一个非空行。
- `argument-hint` 可选。设置后，提示会显示在自动完成下拉中描述之前。

### 参数提示

在 frontmatter 中使用 `argument-hint`，以在自动完成中显示预期参数。用 `<尖括号>` 表示必需参数，用 `[方括号]` 表示可选参数：

```markdown
---
description: Review PRs from URLs with structured issue and code analysis
argument-hint: "<PR-URL>"
---
```

这在自动完成下拉中呈现为：

```
→ pr   <PR-URL>       — Review PRs from URLs with structured issue and code analysis
  is   <issue>        — Analyze GitHub issues (bugs or feature requests)
  wr   [instructions] — Finish the current task end-to-end
  cl   — Audit changelog entries before release
```

## 用法

在编辑器中输入 `/` 后跟模板名。自动完成会显示带描述的可用模板。

```
/review                           # Expands review.md
/component Button                 # Expands with argument
/component Button "click handler" # Multiple arguments
```

## 参数

模板支持位置参数、默认值与简单切片：

- `$1`、`$2`、... 位置参数
- `$@` 或 `$ARGUMENTS` 表示所有参数拼接
- `${1:-default}` 在参数 1 存在且非空时使用它，否则使用 `default`
- `${@:-default}` 或 `${ARGUMENTS:-default}` 在存在且非空时使用全部参数，否则使用 `default`
- `${@:N}` 表示从第 N 个位置起的参数（1 起始）
- `${@:N:L}` 表示从 N 开始的 `L` 个参数

示例：

```markdown
---
description: Create a component
---
Create a React component named $1 with features: $@
```

默认值对可选参数很有用：

```markdown
Summarize the current state in ${1:-7} bullet points.
```

用法：`/component Button "onClick handler" "disabled support"`

## 加载规则

- `prompts/` 中的模板发现是非递归的。
- 若希望子目录中也有模板，请通过 `prompts` 设置或包清单显式添加。
