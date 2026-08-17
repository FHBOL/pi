# 快捷键

所有键盘快捷键都可通过 `~/.pi/agent/keybindings.json` 自定义。每个动作可绑定一个或多个按键。

配置文件使用与 pi 内部相同、且扩展作者在 `keyHint()` 与注入的 `keybindings` 管理器中使用的带命名空间快捷键 id。

使用旧版无命名空间 id（如 `cursorUp` 或 `expandTools`）的旧配置会在启动时自动迁移为带命名空间的 id。

编辑 `keybindings.json` 后，在 pi 中运行 `/reload` 即可应用更改，无需重启会话。

## 按键格式

`modifier+key`，其中修饰键为 `ctrl`、`shift`、`alt`（可组合），按键为：

- **字母：** `a-z`
- **数字：** `0-9`
- **特殊键：** `escape`、`esc`、`enter`、`return`、`tab`、`space`、`backspace`、`delete`、`insert`、`clear`、`home`、`end`、`pageUp`、`pageDown`、`up`、`down`、`left`、`right`
- **功能键：** `f1`-`f12`
- **符号：** `` ` ``、`-`、`=`、`[`、`]`、`\`、`;`、`'`、`,`、`.`、`/`、`!`、`@`、`#`、`$`、`%`、`^`、`&`、`*`、`(`、`)`、`_`、`+`、`|`、`~`、`{`、`}`、`:`、`<`、`>`、`?`

修饰键组合：`ctrl+shift+x`、`alt+ctrl+x`、`ctrl+shift+alt+x`、`ctrl+1` 等。

## 全部动作

### TUI 编辑器光标移动

| 快捷键 id | 默认 | 说明 |
|--------|---------|-------------|
| `tui.editor.cursorUp` | `up` | 光标上移；在顶部浏览更旧的历史 |
| `tui.editor.cursorDown` | `down` | 光标下移；在底部浏览更新的历史 |
| `tui.editor.historyPrevious` | *(无)* | 选择上一条提示历史条目 |
| `tui.editor.historyNext` | *(无)* | 选择下一条提示历史条目 |
| `tui.editor.cursorLeft` | `left`、`ctrl+b` | 光标左移 |
| `tui.editor.cursorRight` | `right`、`ctrl+f` | 光标右移 |
| `tui.editor.cursorWordLeft` | `alt+left`、`ctrl+left`、`alt+b` | 按词左移 |
| `tui.editor.cursorWordRight` | `alt+right`、`ctrl+right`、`alt+f` | 按词右移 |
| `tui.editor.cursorLineStart` | `home`、`ctrl+home`、`ctrl+a` | 移到行首 |
| `tui.editor.cursorLineEnd` | `end`、`ctrl+end`、`ctrl+e` | 移到行尾 |
| `tui.editor.jumpForward` | `ctrl+]` | 向前跳到字符 |
| `tui.editor.jumpBackward` | `ctrl+alt+]` | 向后跳到字符 |
| `tui.editor.pageUp` | `pageUp`、`ctrl+pageUp` | 向上翻页 |
| `tui.editor.pageDown` | `pageDown`、`ctrl+pageDown` | 向下翻页 |

专用历史动作始终切换历史条目，与多行提示中的光标位置无关。在主编辑器获得焦点时，显式历史绑定优先于应用动作，因此将 `tui.editor.historyPrevious` 绑定到 `ctrl+p` 会在该上下文中覆盖模型循环，而不会改变选择器中的 `Ctrl+P`。

### TUI 编辑器删除

| 快捷键 id | 默认 | 说明 |
|--------|---------|-------------|
| `tui.editor.deleteCharBackward` | `backspace` | 向后删除字符 |
| `tui.editor.deleteCharForward` | `delete`、`ctrl+d` | 向前删除字符 |
| `tui.editor.deleteWordBackward` | `ctrl+w`、`alt+backspace` | 向后删除词 |
| `tui.editor.deleteWordForward` | `alt+d`、`alt+delete` | 向前删除词 |
| `tui.editor.deleteToLineStart` | `ctrl+u` | 删除到行首 |
| `tui.editor.deleteToLineEnd` | `ctrl+k` | 删除到行尾 |

### TUI 输入

| 快捷键 id | 默认 | 说明 |
|--------|---------|-------------|
| `tui.input.newLine` | `shift+enter`、`ctrl+j` | 插入新行 |
| `tui.input.submit` | `enter` | 提交输入 |
| `tui.input.tab` | `tab` | Tab / 自动补全 |

### TUI Kill Ring

| 快捷键 id | 默认 | 说明 |
|--------|---------|-------------|
| `tui.editor.yank` | `ctrl+y` | 粘贴最近删除的文本 |
| `tui.editor.yankPop` | `alt+y` | yank 后在已删除文本间循环 |
| `tui.editor.undo` | `ctrl+-` | 撤销上次编辑 |

### TUI 剪贴板与选择

| 快捷键 id | 默认 | 说明 |
|--------|---------|-------------|
| `tui.input.copy` | `ctrl+c` | 复制选区 |
| `tui.select.up` | `up` | 选择上移 |
| `tui.select.down` | `down` | 选择下移 |
| `tui.select.pageUp` | `pageUp` | 列表向上翻页 |
| `tui.select.pageDown` | `pageDown` | 列表向下翻页 |
| `tui.select.confirm` | `enter` | 确认选择 |
| `tui.select.cancel` | `escape`、`ctrl+c` | 取消选择 |

### TUI 全屏视口

这些动作在交互模式使用 `--tui-mode fullscreen` 时生效，作用于主对话滚动区域。双指触控板与鼠标滚轮滚动指针下方区域；在固定的编辑器/状态/页脚停靠区上方时回退到对话区域。点击 OSC 8 超链接会在默认处理程序中打开。用主鼠标按钮拖动可选择文本并复制到剪贴板；按住对话顶部或底部边缘会自动滚动到屏幕外内容。

全屏对话绑定优先于编辑器绑定。因此默认的无修饰导航键在全屏模式中控制对话，而其 `ctrl` 变体继续控制编辑器。在全屏模式外，两种变体都控制编辑器。

| 按键 | 默认模式 | 全屏模式 |
|-----|--------------|-----------------|
| `home`、`end` | 编辑器 | 对话 |
| `ctrl+home`、`ctrl+end` | 编辑器 | 编辑器 |
| `pageUp`、`pageDown` | 编辑器 | 对话 |
| `ctrl+pageUp`、`ctrl+pageDown` | 编辑器 | 编辑器 |

此路由仍可通过普通动作绑定配置。例如，`"tui.altScreen.pageUp": "ctrl+pageUp"` 使 `pageUp` 控制编辑器，而 `ctrl+pageUp` 在全屏模式中控制对话。设置 `"tui.altScreen.pageUp": []` 会完全禁用该对话快捷键。用户绑定会替换该动作的默认值。

| 快捷键 id | 默认 | 说明 |
|--------|---------|-------------|
| `tui.altScreen.pageUp` | `pageUp` | 对话向上翻一页 |
| `tui.altScreen.pageDown` | `pageDown` | 对话向下翻一页 |
| `tui.altScreen.previousPrompt` | `ctrl+shift+up` | 跳到上一条标记消息 |
| `tui.altScreen.nextPrompt` | `ctrl+shift+down` | 跳到下一条标记消息 |
| `tui.altScreen.top` | `home` | 滚动到对话开头 |
| `tui.altScreen.bottom` | `end` | 滚动到对话末尾并跟随新输出 |

### 应用

| 快捷键 id | 默认 | 说明 |
|--------|---------|-------------|
| `app.interrupt` | `escape` | 取消 / 中止 |
| `app.clear` | `ctrl+c` | 清空编辑器 |
| `app.exit` | `ctrl+d` | 退出（编辑器为空时） |
| `app.suspend` | `ctrl+z`（Windows 上无） | 挂起到后台 |
| `app.editor.external` | `ctrl+g` | 在外部编辑器中打开（`externalEditor`、`$VISUAL`、`$EDITOR`，Windows 上为 Notepad，其他平台为 `nano`） |
| `app.clipboard.pasteImage` | `ctrl+v`（Windows 上为 `alt+v`） | 从剪贴板粘贴图片 |

### 会话

| 快捷键 id | 默认 | 说明 |
|--------|---------|-------------|
| `app.session.new` | *(无)* | 开始新会话（`/new`） |
| `app.session.tree` | *(无)* | 打开会话树导航器（`/tree`） |
| `app.session.fork` | *(无)* | Fork 当前会话（`/fork`） |
| `app.session.resume` | *(无)* | 打开会话恢复选择器（`/resume`） |
| `app.session.togglePath` | `ctrl+p` | 切换路径显示 |
| `app.session.toggleSort` | `ctrl+s` | 切换排序模式 |
| `app.session.toggleNamedFilter` | `ctrl+n` | 切换仅命名会话过滤 |
| `app.session.rename` | `ctrl+r` | 重命名会话 |
| `app.session.delete` | `ctrl+d` | 删除会话 |
| `app.session.deleteNoninvasive` | `ctrl+backspace` | 查询为空时删除会话 |

### 模型与思考

| 快捷键 id | 默认 | 说明 |
|--------|---------|-------------|
| `app.model.select` | `ctrl+l` | 打开模型选择器 |
| `app.model.cycleForward` | `ctrl+p` | 循环到下一个模型 |
| `app.model.cycleBackward` | `shift+ctrl+p` | 循环到上一个模型 |
| `app.thinking.cycle` | `shift+tab` | 循环思考级别 |
| `app.thinking.toggle` | `ctrl+t` | 折叠或展开思考块 |

### 显示与消息队列

| 快捷键 id | 默认 | 说明 |
|--------|---------|-------------|
| `app.tools.expand` | `ctrl+o` | 折叠或展开工具输出 |
| `app.message.copy` | `ctrl+x` | 复制最后一条助手消息，或在 `/tree` 中复制选中的消息 |
| `app.message.followUp` | `alt+enter` | 排队后续消息 |
| `app.message.dequeue` | `alt+up` | 将已排队消息恢复到编辑器 |

### 树导航

| 快捷键 id | 默认 | 说明 |
|--------|---------|-------------|
| `app.tree.foldOrUp` | `ctrl+left`、`alt+left` | 折叠当前分支段，或跳到上一段起点 |
| `app.tree.unfoldOrDown` | `ctrl+right`、`alt+right` | 展开当前分支段，或跳到下一段起点或分支末尾 |
| `app.tree.editLabel` | `shift+l` | 编辑选中树节点上的标签 |
| `app.tree.toggleLabelTimestamp` | `shift+t` | 切换树中标签时间戳 |
| `app.tree.filter.default` | `ctrl+d` | 将树过滤设为默认视图 |
| `app.tree.filter.noTools` | `ctrl+t` | 切换隐藏工具结果的树过滤 |
| `app.tree.filter.userOnly` | `ctrl+u` | 切换仅显示用户消息的树过滤 |
| `app.tree.filter.labeledOnly` | `ctrl+l` | 切换仅显示带标签条目的树过滤 |
| `app.tree.filter.all` | `ctrl+a` | 切换显示全部条目的树过滤 |
| `app.tree.filter.cycleForward` | `ctrl+o` | 向前循环树过滤 |
| `app.tree.filter.cycleBackward` | `shift+ctrl+o` | 向后循环树过滤 |

### 限定模型选择器

用于限定模型选择器内（通过 `/scoped-models` 打开）。

| 快捷键 id | 默认 | 说明 |
|--------|---------|-------------|
| `app.models.save` | `ctrl+s` | 将当前模型选择保存到设置 |
| `app.models.enableAll` | `ctrl+a` | 启用全部模型（或全部匹配当前搜索的模型） |
| `app.models.clearAll` | `ctrl+x` | 清除全部模型（或全部匹配当前搜索的模型） |
| `app.models.toggleProvider` | `ctrl+p` | 切换当前提供商的全部模型 |
| `app.models.reorderUp` | `alt+up` | 将选中模型在循环顺序中上移 |
| `app.models.reorderDown` | `alt+down` | 将选中模型在循环顺序中下移 |

## 自定义配置

创建 `~/.pi/agent/keybindings.json`：

```json
{
  "tui.editor.historyPrevious": "ctrl+p",
  "tui.editor.historyNext": "ctrl+n",
  "tui.editor.deleteWordBackward": ["ctrl+w", "alt+backspace"]
}
```

每个动作可以是单个按键或按键数组。用户配置覆盖默认值。

在原生 Windows 上，`app.suspend` 没有默认绑定，因为 Windows 终端不支持 Unix 作业控制。若手动绑定，pi 会显示状态消息而不是挂起。在 WSL 中，正常的 Linux `ctrl+z`/`fg` 行为仍然适用。

### Emacs 示例

```json
{
  "tui.editor.historyPrevious": "ctrl+p",
  "tui.editor.historyNext": "ctrl+n",
  "tui.editor.cursorLeft": ["left", "ctrl+b"],
  "tui.editor.cursorRight": ["right", "ctrl+f"],
  "tui.editor.cursorWordLeft": ["alt+left", "alt+b"],
  "tui.editor.cursorWordRight": ["alt+right", "alt+f"],
  "tui.editor.deleteCharForward": ["delete", "ctrl+d"],
  "tui.editor.deleteCharBackward": ["backspace", "ctrl+h"],
  "tui.input.newLine": ["shift+enter", "ctrl+j"]
}
```

### Vim 示例

```json
{
  "tui.editor.cursorUp": ["up", "alt+k"],
  "tui.editor.cursorDown": ["down", "alt+j"],
  "tui.editor.cursorLeft": ["left", "alt+h"],
  "tui.editor.cursorRight": ["right", "alt+l"],
  "tui.editor.cursorWordLeft": ["alt+left", "alt+b"],
  "tui.editor.cursorWordRight": ["alt+right", "alt+w"]
}
```
