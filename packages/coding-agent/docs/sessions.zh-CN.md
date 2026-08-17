# 会话（Sessions）

Pi 将对话保存为会话，以便你继续工作、从先前轮次分支，以及回顾之前的路径。

## 会话存储

会话自动保存到 `~/.pi/agent/sessions/`，按工作目录组织。每个会话是一个具有树结构的 JSONL 文件。

```bash
pi -c                  # Continue most recent session
pi -r                  # Browse and select from past sessions
pi --no-session        # Ephemeral mode; do not save
pi --name "my task"    # Set session display name at startup
pi --session <path|id> # Use a specific session file or partial session ID
pi --fork <path|id>    # Fork a session file or partial session ID into a new session
```

在交互模式中使用 `/session` 可查看当前会话文件、会话 ID、消息数量、token 与费用。

关于 JSONL 文件格式和 SessionManager API，参见 [会话格式](session-format.zh-CN.md)。

## 会话命令

| 命令 | 说明 |
|---------|-------------|
| `/resume` | 浏览并选择先前的会话 |
| `/new` | 开始新会话 |
| `/name <name>` | 设置当前会话的显示名称 |
| `/session` | 显示会话信息 |
| `/tree` | 在当前会话树中导航 |
| `/fork` | 从先前的用户消息创建新会话 |
| `/clone` | 将当前活动分支复制为新会话 |
| `/compact [prompt]` | 汇总较早的上下文；参见 [压缩](compaction.zh-CN.md) |
| `/export [file]` | 将会话导出为 HTML |
| `/share` | 上传为私有 GitHub gist，并提供可分享的 HTML 链接 |

## 恢复与删除会话

`/resume` 会打开当前项目的交互式会话选择器。`pi -r` 在启动时打开同一选择器。

在选择器中你可以：

- 输入进行搜索
- 用 Ctrl+P 切换路径显示
- 用 Ctrl+S 切换排序模式
- 用 Ctrl+N 筛选到已命名会话
- 用 Ctrl+R 重命名
- 用 Ctrl+D 删除，然后确认

可用时，pi 会使用 `trash` CLI 进行删除，而不是永久移除文件。

## 命名会话

使用 `/name <name>` 设置人类可读的会话名称：

```text
/name Refactor auth module
```

启动时用 `--name` 或 `-n` 设置名称：

```bash
pi --name "Refactor auth module"
pi --name "CI audit" -p "Review this build failure"
```

已命名会话更容易在 `/resume` 和 `pi -r` 中找到。

## 使用 `/tree` 分支

会话以树的形式存储。每个条目都有 `id` 和 `parentId`，当前位置是活动叶子节点。`/tree` 让你可以跳到任意先前点并从那里继续，而无需创建新文件。

<p align="center"><img src="images/tree-view.png" alt="Tree View" width="600"></p>

示例形状：

```text
├─ user: "Hello, can you help..."
│  └─ assistant: "Of course! I can..."
│     ├─ user: "Let's try approach A..."
│     │  └─ assistant: "For approach A..."
│     │     └─ user: "That worked..."  ← active
│     └─ user: "Actually, approach B..."
│        └─ assistant: "For approach B..."
```

### 树控件

| 按键 | 操作 |
|-----|--------|
| ↑/↓ | 在可见条目间导航 |
| ←/→ | 上/下翻页 |
| Ctrl+←/Ctrl+→ 或 Alt+←/Alt+→ | 折叠/展开，或在分支段之间跳转 |
| Shift+L | 为选中条目设置或清除标签 |
| Shift+T | 切换标签时间戳 |
| Enter | 选择条目 |
| Escape/Ctrl+C | 取消 |
| Ctrl+O | 循环筛选模式 |

筛选模式为：default、no-tools、user-only、labeled-only 和 all。用 [设置](settings.md) 中的 `treeFilterMode` 配置默认值。

### 选择行为

选择用户消息或自定义消息时：

1. 将叶子移到所选消息的父节点。
2. 将所选消息文本放入编辑器。
3. 允许你编辑并重新提交，从而创建新分支。

选择助手、工具、压缩或其他非用户条目时：

1. 将叶子移到该条目。
2. 编辑器保持为空。
3. 允许你从该点继续。

选择根用户消息会将叶子重置为空对话，并把原始提示放入编辑器。

## `/tree`、`/fork` 与 `/clone`

| 特性 | `/tree` | `/fork` | `/clone` |
|---------|---------|---------|----------|
| 输出 | 同一会话文件 | 新会话文件 | 新会话文件 |
| 视图 | 完整树 | 用户消息选择器 | 当前活动分支 |
| 典型用途 | 就地探索备选方案 | 从较早提示开始新会话 | 在继续前复制当前工作 |
| 摘要 | 可选的分支摘要 | 无 | 无 |

想把备选方案放在一起时用 `/tree`。想要单独会话文件时用 `/fork` 或 `/clone`。

## 分支摘要

当 `/tree` 从一个分支切换到另一个时，pi 可以汇总被放弃的分支，并把该摘要附加到新位置。这样可以在不重放整条分支的情况下，保留你离开那条路径上的重要上下文。

出现提示时，选择其一：

1. 不生成摘要
2. 使用默认提示进行汇总
3. 使用自定义关注说明进行汇总

关于分支汇总的内部机制与扩展钩子，参见 [压缩](compaction.zh-CN.md)。

## 会话格式

会话文件为 JSONL，包含消息条目、模型变更、思考级别变更、标签、压缩、分支摘要以及扩展条目。

关于解析器、扩展、SDK 用法以及完整的 SessionManager API，参见 [会话格式](session-format.zh-CN.md)。
