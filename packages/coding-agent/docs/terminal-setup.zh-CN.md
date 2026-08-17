# 终端设置

Pi 使用 [Kitty 键盘协议](https://sw.kovidgoyal.net/kitty/keyboard-protocol/) 以实现可靠的修饰键检测。多数现代终端支持该协议，但有些需要配置。

## Kitty、iTerm2

开箱即用。

## Apple Terminal

Pi 会在可用时启用增强按键报告。若 Terminal.app 仍对 `Shift+Enter` 发送普通 Return，pi 会使用本地 macOS 修饰键回退，将该 Return 视为 `Shift+Enter`。

此回退仅在 pi 与 Terminal.app 运行在同一台 Mac 上时有效。通过远程 SSH 时无法检测本地键盘。

## Ghostty

添加到你的 Ghostty 配置（macOS 上为 `~/Library/Application Support/com.mitchellh.ghostty/config`，Linux 上为 `~/.config/ghostty/config`）：

```
keybind = alt+backspace=text:\x1b\x7f
```

较旧的 Claude Code 版本可能添加过此 Ghostty 映射：

```
keybind = shift+enter=text:\n
```

该映射会发送原始换行字节。在 pi 内这与 `Ctrl+J` 无法区分，因此 tmux 与 pi 都看不到真正的 `shift+enter` 按键事件。

若你当初只是为了 Claude Code 2.x 或更高版本才添加该映射，可以移除它——除非你要在 tmux 中使用 Claude Code（那时仍需要该 Ghostty 映射）。

Pi 将 `Ctrl+J` 绑定为默认换行别名，因此在 tmux 中可通过该重映射继续使用 `Shift+Enter`，无需额外 pi 配置。

## WezTerm

WezTerm 通常通过 xterm modifyOtherKeys 即可开箱支持 `Shift+Enter`。若要显式使用 Kitty 键盘协议，创建 `~/.wezterm.lua`：

```lua
local wezterm = require 'wezterm'
local config = wezterm.config_builder()
config.enable_kitty_keyboard = true
return config
```

在 macOS 上，WezTerm 默认将 `Option+Enter` 绑定为全屏。若要用 `Option+Enter` 进行 pi 的后续消息排队，添加此按键覆盖：

```lua
local wezterm = require 'wezterm'
local config = wezterm.config_builder()
config.keys = {
  {
    key = 'Enter',
    mods = 'ALT',
    action = wezterm.action.SendString('\x1b[13;3u'),
  },
}
return config
```

若已有 `config.keys` 表，将条目加入其中即可。

在 WSL 上，WezTerm 可能需要可见的硬件光标以便定位 IME 候选窗口。若 CJK IME 候选不跟随文本光标，请在运行 pi 前设置 `PI_HARDWARE_CURSOR=1`，或在设置中将 `showHardwareCursor` 设为 `true`。

## Alacritty

Alacritty 通常对 `Shift+Enter` 开箱即用。在 macOS 上，`Option+Enter` 可能作为普通 `Enter` 到达。若要用 `Option+Enter` 进行 pi 的后续消息排队，添加到 `~/.config/alacritty/alacritty.toml`：

```toml
[[keyboard.bindings]]
key = "Enter"
mods = "Alt"
chars = "\u001b[13;3u"
```

更改配置后重启 Alacritty。

## VS Code（集成终端）

VS Code 1.109.5 及更高版本默认在集成终端启用 Kitty 键盘协议，因此 `Shift+Enter` 应开箱即用。

早于 1.109.5 的 VS Code 版本需要为 `Shift+Enter` 显式设置终端快捷键。

`keybindings.json` 位置：
- macOS: `~/Library/Application Support/Code/User/keybindings.json`
- Linux: `~/.config/Code/User/keybindings.json`
- Windows: `%APPDATA%\\Code\\User\\keybindings.json`

添加到 `keybindings.json`：

```json
{
  "key": "shift+enter",
  "command": "workbench.action.terminal.sendSequence",
  "args": { "text": "\u001b[13;2u" },
  "when": "terminalFocus"
}
```

## Windows Terminal

添加到 `settings.json`（Ctrl+Shift+,，或 设置 → 打开 JSON 文件），以转发 pi 使用的带修饰 Enter 键：

```json
{
  "actions": [
    {
      "command": { "action": "sendInput", "input": "\u001b[13;2u" },
      "keys": "shift+enter"
    },
    {
      "command": { "action": "sendInput", "input": "\u001b[13;3u" },
      "keys": "alt+enter"
    }
  ]
}
```

- `Shift+Enter` 插入新行。
- Windows Terminal 默认将 `Alt+Enter` 绑定为全屏。这会阻止 pi 接收用于后续消息排队的 `Alt+Enter`。
- 将 `Alt+Enter` 重映射为 `sendInput` 会把真正的组合键转发给 pi。

若已有 `actions` 数组，将对象加入其中即可。若旧的全屏行为仍然存在，请完全关闭并重新打开 Windows Terminal。

## xfce4-terminal、terminator

这些终端的转义序列支持有限。诸如 `Ctrl+Enter` 与 `Shift+Enter` 的带修饰 Enter 无法与普通 `Enter` 区分，导致像 `submit: ["ctrl+enter"]` 这类自定义快捷键无法工作。

为获得最佳体验，请使用支持 Kitty 键盘协议的终端：
- [Kitty](https://sw.kovidgoyal.net/kitty/)
- [Ghostty](https://ghostty.org/)
- [WezTerm](https://wezfurlong.org/wezterm/)
- [iTerm2](https://iterm2.com/)
- [Alacritty](https://github.com/alacritty/alacritty)（需编译启用 Kitty 协议支持）

## IntelliJ IDEA（集成终端）

内置终端的转义序列支持有限。在 IntelliJ 终端中无法区分 Shift+Enter 与 Enter。

若希望显示硬件光标，请在运行 pi 前设置 `PI_HARDWARE_CURSOR=1`（为兼容性默认禁用）。

建议使用专用终端模拟器以获得最佳体验。
