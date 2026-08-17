---
description: Worker 实现，reviewer 审查，worker 应用反馈
---
使用带 chain 参数的 subagent 工具执行此工作流：

1. 首先，使用 "worker" 代理实现：$@
2. 然后，使用 "reviewer" 代理审查上一步的实现（使用 {previous} 占位符）
3. 最后，使用 "worker" 代理应用审查反馈（使用 {previous} 占位符）

以链式方式执行，通过 {previous} 在步骤间传递输出。
