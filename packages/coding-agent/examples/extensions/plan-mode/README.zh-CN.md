# 计划模式扩展

只读探索模式，用于安全的代码分析。

## 功能

- **禁用内置写入工具**：禁用 edit/write，同时保留其他活动工具
- **Bash 白名单**：仅允许只读 bash 命令
- **计划提取**：从 `Plan:` 小节提取编号步骤
- **进度跟踪**：执行期间 widget 显示完成状态
- **[DONE:n] 标记**：显式的步骤完成跟踪
- **会话持久化**：状态在会话恢复后仍然保留

## 命令

- `/plan` - 切换计划模式
- `/todos` - 显示当前计划进度
- `Ctrl+Alt+P` - 切换计划模式（快捷键）

## 用法

1. 用 `/plan` 或 `--plan` 标志启用计划模式
2. 让 agent 分析代码并创建计划
3. Agent 应在 `Plan:` 标题下输出编号计划：

```
Plan:
1. First step description
2. Second step description
3. Third step description
```

4. 提示时选择「Execute the plan」
5. 执行期间，agent 用 `[DONE:n]` 标签标记步骤完成
6. 进度 widget 显示完成状态

## 工作原理

### 计划模式（只读）
- 禁用内置 edit/write 工具
- 其他活动工具仍可用
- Bash 命令经白名单过滤
- Agent 创建计划但不做更改

### 执行模式
- 恢复完整工具访问
- Agent 按顺序执行步骤
- `[DONE:n]` 标记跟踪完成情况
- Widget 显示进度

### 命令白名单

安全命令（允许）：
- 文件查看：`cat`、`head`、`tail`、`less`、`more`
- 搜索：`grep`、`find`、`rg`、`fd`
- 目录：`ls`、`pwd`、`tree`
- Git 读取：`git status`、`git log`、`git diff`、`git branch`
- 包信息：`npm list`、`npm outdated`、`yarn info`
- 系统信息：`uname`、`whoami`、`date`、`uptime`

被阻止的命令：
- 文件修改：`rm`、`mv`、`cp`、`mkdir`、`touch`
- Git 写入：`git add`、`git commit`、`git push`
- 包安装：`npm install`、`yarn add`、`pip install`
- 系统：`sudo`、`kill`、`reboot`
- 编辑器：`vim`、`nano`、`code`
