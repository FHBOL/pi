# Shell 别名

Pi 以非交互模式运行 bash（`bash -c`），默认不会展开别名。

要启用你的 shell 别名，请在 `~/.pi/agent/settings.json` 中添加：

```json
{
  "shellCommandPrefix": "shopt -s expand_aliases\neval \"$(grep '^alias ' ~/.zshrc)\""
}
```

按你的 shell 配置调整路径（`~/.zshrc`、`~/.bashrc` 等）。
