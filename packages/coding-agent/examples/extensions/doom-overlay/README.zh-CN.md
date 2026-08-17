# DOOM 浮层演示

在 pi 中以浮层形式游玩 DOOM。演示浮层系统能以 35 FPS 处理实时游戏渲染。

## 用法

```bash
pi --extension ./examples/extensions/doom-overlay
```

然后运行：
```
/doom-overlay
```

共享版 WAD 文件（约 4MB）会在首次运行时自动下载。

## 操作

| 动作 | 按键 |
|------|------|
| 移动 | WASD 或方向键 |
| 奔跑 | Shift + WASD |
| 射击 | F 或 Ctrl |
| 使用/打开 | Space |
| 武器 | 1-7 |
| 地图 | Tab |
| 菜单 | Escape |
| 暂停/退出 | Q |

## 工作原理

DOOM 以从 [doomgeneric](https://github.com/ozkl/doomgeneric) 编译的 WebAssembly 运行。每一帧使用半块字符（▀）与 24 位颜色渲染，上半像素为前景色，下半像素为背景色。

浮层使用：
- `width: "90%"` - 终端宽度的 90%
- `maxHeight: "80%"` - 终端高度最多 80%
- `anchor: "center"` - 在终端中居中

高度由宽度计算，以保持 DOOM 的 3.2:1 宽高比（计入半块渲染）。

## 致谢

- [id Software](https://github.com/id-Software/DOOM) 提供原始 DOOM
- [doomgeneric](https://github.com/ozkl/doomgeneric) 提供可移植 DOOM 实现
- [pi-doom](https://github.com/badlogic/pi-doom) 提供原始 pi 集成
