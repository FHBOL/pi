# Windows 设置

Pi 在 Windows 上需要 bash shell。按顺序检查的位置：

1. `~/.pi/agent/settings.json` 中的自定义路径
2. Git Bash（`C:\Program Files\Git\bin\bash.exe`）
3. PATH 上的 `bash.exe`（Cygwin、MSYS2、WSL）

对大多数用户，[Git for Windows](https://git-scm.com/download/win) 已足够。

## 自定义 Shell 路径

```json
{
  "shellPath": "C:\\cygwin64\\bin\\bash.exe"
}
```
