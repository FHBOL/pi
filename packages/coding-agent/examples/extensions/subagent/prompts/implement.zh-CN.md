---
description: 完整实现工作流 —— scout 收集上下文，planner 制定计划，worker 实现
---
使用带 chain 参数的 subagent 工具执行此工作流：

1. 首先，使用 "scout" 代理查找与以下内容相关的所有代码：$@
2. 然后，使用 "planner" 代理，利用上一步的上下文（使用 {previous} 占位符）为 "$@" 创建实现计划
3. 最后，使用 "worker" 代理实现上一步的计划（使用 {previous} 占位符）

以链式方式执行，通过 {previous} 在步骤间传递输出。
