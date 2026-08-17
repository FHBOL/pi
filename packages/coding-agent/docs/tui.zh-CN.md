> pi 可以创建 TUI 组件。可以请它按你的场景构建一个。

# TUI 组件

扩展和自定义工具可以渲染自定义 TUI 组件，用于交互式用户界面。本文介绍组件系统与可用的构建块。

**源码：** [`@earendil-works/pi-tui`](https://github.com/earendil-works/pi-mono/tree/main/packages/tui)

## 组件接口

所有组件都实现：

```typescript
interface Component {
  render(width: number): string[];
  handleInput?(data: string): void;
  wantsKeyRelease?: boolean;
  invalidate(): void;
}
```

| 方法 | 说明 |
|--------|-------------|
| `render(width)` | 返回字符串数组（每行一条）。每一行**不得超过 `width`**。 |
| `handleInput?(data)` | 组件获得焦点时接收键盘输入。 |
| `wantsKeyRelease?` | 若为 true，组件会收到按键释放事件（Kitty 协议）。默认：false。 |
| `invalidate()` | 清除缓存的渲染状态。主题变更时调用。 |

TUI 会在每条已渲染行末尾追加完整的 SGR 重置与 OSC 8 重置。样式不会跨行延续。若输出带样式的多行文本，请按行重新应用样式，或使用 `wrapTextWithAnsi()`，以便换行后仍保留样式。

## Focusable 接口（IME 支持）

需要显示文本光标并支持 IME（输入法编辑器）的组件应实现 `Focusable` 接口：

```typescript
import { CURSOR_MARKER, type Component, type Focusable } from "@earendil-works/pi-tui";

class MyInput implements Component, Focusable {
  focused: boolean = false;  // Set by TUI when focus changes
  
  render(width: number): string[] {
    const marker = this.focused ? CURSOR_MARKER : "";
    // Emit marker right before the fake cursor
    return [`> ${beforeCursor}${marker}\x1b[7m${atCursor}\x1b[27m${afterCursor}`];
  }
}
```

当 `Focusable` 组件获得焦点时，TUI 会：
1. 将该组件的 `focused` 设为 `true`
2. 扫描渲染输出中的 `CURSOR_MARKER`（零宽度 APC 转义序列）
3. 将硬件终端光标定位到该位置
4. 仅在启用 `showHardwareCursor` 时显示硬件光标

光标默认保持隐藏。这样仍可渲染伪光标，同时为在隐藏光标下跟踪 IME 候选窗的终端定位硬件光标。部分终端需要可见硬件光标才能正确放置 IME；可通过 `showHardwareCursor`、`setShowHardwareCursor(true)` 或 `PI_HARDWARE_CURSOR=1` 启用。内置的 `Editor` 与 `Input` 组件已实现该接口。

### 内嵌输入的容器组件

当容器组件（对话框、选择器等）包含 `Input` 或 `Editor` 子组件时，容器必须实现 `Focusable`，并将焦点状态传播给子组件。否则硬件光标无法为 IME 输入正确定位。

```typescript
import { Container, type Focusable, Input } from "@earendil-works/pi-tui";

class SearchDialog extends Container implements Focusable {
  private searchInput: Input;

  // Focusable implementation - propagate to child input for IME cursor positioning
  private _focused = false;
  get focused(): boolean {
    return this._focused;
  }
  set focused(value: boolean) {
    this._focused = value;
    this.searchInput.focused = value;
  }

  constructor() {
    super();
    this.searchInput = new Input();
    this.addChild(this.searchInput);
  }
}
```

若不做此传播，使用 IME（中文、日文、韩文等）输入时，候选窗会显示在屏幕上的错误位置。

## 使用组件

**在扩展中**通过 `ctx.ui.custom()`：

```typescript
pi.on("session_start", async (_event, ctx) => {
  const result = await ctx.ui.custom<string | null>((tui, theme, keybindings, done) =>
    new MyComponent({
      theme,
      keybindings,
      onChange: () => tui.requestRender(),
      onSelect: (value) => done(value),
      onCancel: () => done(null),
    })
  );
});
```

**在自定义工具中**通过 `ctx.ui.custom()`：

```typescript
async execute(toolCallId, params, signal, onUpdate, ctx) {
  const result = await ctx.ui.custom<string | null>((tui, theme, keybindings, done) =>
    new MyComponent({
      theme,
      keybindings,
      onChange: () => tui.requestRender(),
      onSelect: (value) => done(value),
      onCancel: () => done(null),
    })
  );
  // Use result...
}
```

## 叠层（Overlays）

叠层会在不清屏的情况下，将组件渲染在现有内容之上。向 `ctx.ui.custom()` 传入 `{ overlay: true }`：

```typescript
const result = await ctx.ui.custom<string | null>(
  (tui, theme, keybindings, done) => new MyDialog({ onClose: done }),
  { overlay: true }
);
```

定位与尺寸可使用 `overlayOptions`：

```typescript
const result = await ctx.ui.custom<string | null>(
  (tui, theme, keybindings, done) => new SidePanel({ onClose: done }),
  {
    overlay: true,
    overlayOptions: {
      // Size: number or percentage string
      width: "50%",          // 50% of terminal width
      minWidth: 40,          // minimum 40 columns
      maxHeight: "80%",      // max 80% of terminal height

      // Position: anchor-based (default: "center")
      anchor: "right-center", // 9 positions: center, top-left, top-center, etc.
      offsetX: -2,            // offset from anchor
      offsetY: 0,

      // Or percentage/absolute positioning
      row: "25%",            // 25% from top
      col: 10,               // column 10

      // Margins
      margin: 2,             // all sides, or { top, right, bottom, left }

      // Responsive: hide on narrow terminals
      visible: (termWidth, termHeight) => termWidth >= 80,
    },
    // Get handle for programmatic focus and visibility control
    onHandle: (handle) => {
      // handle.focus() - focus this overlay and bring it to the visual front
      // handle.unfocus() - release input to normal fallback
      // handle.unfocus({ target }) - release input to a specific component or null
      // handle.setHidden(true/false) - toggle visibility
      // handle.hide() - permanently remove
    },
  }
);
```

### 叠层焦点

已聚焦且可见的叠层会在临时非叠层 UI 期间保留输入所有权。若叠层打开另一个未带 `{ overlay: true }` 的 `ctx.ui.custom()` 组件，该替换 UI 在活动期间接收输入；关闭后，已聚焦的叠层可重新取得输入。

当可见叠层应停止拥有输入、让 TUI 回退到另一个可见的捕获叠层或先前焦点目标时，使用 `handle.unfocus()`。当叠层保持可见、但希望特定组件接收输入时，使用 `handle.unfocus({ target })`。传入 `{ target: null }` 会有意不留下任何聚焦组件，直到再次设置焦点。

### 叠层生命周期

叠层组件在关闭时会被销毁。不要复用引用——请创建新实例：

```typescript
// Wrong - stale reference
let menu: MenuComponent;
await ctx.ui.custom((_, __, ___, done) => {
  menu = new MenuComponent(done);
  return menu;
}, { overlay: true });
setActiveComponent(menu);  // Disposed

// Correct - re-call to re-show
const showMenu = () => ctx.ui.custom((_, __, ___, done) => 
  new MenuComponent(done), { overlay: true });

await showMenu();  // First show
await showMenu();  // "Back" = just call again
```

完整示例见 [overlay-qa-tests.ts](../examples/extensions/overlay-qa-tests.ts)，覆盖锚点、边距、堆叠、响应式可见性与动画。

## 内置组件

从 `@earendil-works/pi-tui` 导入：

```typescript
import { Text, Box, Container, Spacer, Markdown } from "@earendil-works/pi-tui";
```

### Text

支持自动换行的多行文本。

```typescript
const text = new Text(
  "Hello World",    // content
  1,                // paddingX (default: 1)
  1,                // paddingY (default: 1)
  (s) => bgGray(s)  // optional background function
);
text.setText("Updated");
```

### Box

带内边距与背景色的容器。

```typescript
const box = new Box(
  1,                // paddingX
  1,                // paddingY
  (s) => bgGray(s)  // background function
);
box.addChild(new Text("Content", 0, 0));
box.setBgFn((s) => bgBlue(s));
```

### Container

垂直分组子组件。

```typescript
const container = new Container();
container.addChild(component1);
container.addChild(component2);
container.removeChild(component1);
```

### Spacer

空的垂直间距。

```typescript
const spacer = new Spacer(2);  // 2 empty lines
```

### Markdown

渲染带语法高亮的 Markdown。

```typescript
const md = new Markdown(
  "# Title\n\nSome **bold** text",
  1,        // paddingX
  1,        // paddingY
  theme     // MarkdownTheme (see below)
);
md.setText("Updated markdown");
```

### Image

在受支持的终端中渲染图像（Kitty、iTerm2、Ghostty、WezTerm、Warp）。

```typescript
const image = new Image(
  base64Data,   // base64-encoded image
  "image/png",  // MIME type
  theme,        // ImageTheme
  { maxWidthCells: 80, maxHeightCells: 24 }
);
```

## 键盘输入

使用 `matchesKey()` 检测按键：

```typescript
import { matchesKey, Key } from "@earendil-works/pi-tui";

handleInput(data: string) {
  if (matchesKey(data, Key.up)) {
    this.selectedIndex--;
  } else if (matchesKey(data, Key.enter)) {
    this.onSelect?.(this.selectedIndex);
  } else if (matchesKey(data, Key.escape)) {
    this.onCancel?.();
  } else if (matchesKey(data, Key.ctrl("c"))) {
    // Ctrl+C
  }
}
```

**按键标识符**（使用 `Key.*` 获得自动补全，或使用字符串字面量）：
- 基本键：`Key.enter`、`Key.escape`、`Key.tab`、`Key.space`、`Key.backspace`、`Key.delete`、`Key.home`、`Key.end`
- 方向键：`Key.up`、`Key.down`、`Key.left`、`Key.right`
- 带修饰键：`Key.ctrl("c")`、`Key.shift("tab")`、`Key.alt("left")`、`Key.ctrlShift("p")`
- 字符串格式同样可用：`"enter"`、`"ctrl+c"`、`"shift+tab"`、`"ctrl+shift+p"`

## 行宽

**关键：** `render()` 返回的每一行不得超过 `width` 参数。

```typescript
import { visibleWidth, truncateToWidth } from "@earendil-works/pi-tui";

render(width: number): string[] {
  // Truncate long lines
  return [truncateToWidth(this.text, width)];
}
```

工具函数：
- `visibleWidth(str)` - 获取显示宽度（忽略 ANSI 码）
- `truncateToWidth(str, width, ellipsis?)` - 截断，可选省略号
- `wrapTextWithAnsi(str, width)` - 按词换行并保留 ANSI 码

## 创建自定义组件

示例：交互式选择器

```typescript
import {
  matchesKey, Key,
  truncateToWidth, visibleWidth
} from "@earendil-works/pi-tui";

class MySelector {
  private items: string[];
  private selected = 0;
  private cachedWidth?: number;
  private cachedLines?: string[];
  
  public onSelect?: (item: string) => void;
  public onCancel?: () => void;

  constructor(items: string[]) {
    this.items = items;
  }

  handleInput(data: string): void {
    if (matchesKey(data, Key.up) && this.selected > 0) {
      this.selected--;
      this.invalidate();
    } else if (matchesKey(data, Key.down) && this.selected < this.items.length - 1) {
      this.selected++;
      this.invalidate();
    } else if (matchesKey(data, Key.enter)) {
      this.onSelect?.(this.items[this.selected]);
    } else if (matchesKey(data, Key.escape)) {
      this.onCancel?.();
    }
  }

  render(width: number): string[] {
    if (this.cachedLines && this.cachedWidth === width) {
      return this.cachedLines;
    }

    this.cachedLines = this.items.map((item, i) => {
      const prefix = i === this.selected ? "> " : "  ";
      return truncateToWidth(prefix + item, width);
    });
    this.cachedWidth = width;
    return this.cachedLines;
  }

  invalidate(): void {
    this.cachedWidth = undefined;
    this.cachedLines = undefined;
  }
}
```

在扩展中使用：

```typescript
pi.registerCommand("pick", {
  description: "Pick an item",
  handler: async (_args, ctx) => {
    const items = ["Option A", "Option B", "Option C"];
    const selected = await ctx.ui.custom<string | null>((tui, _theme, _keybindings, done) => {
      const selector = new MySelector(items);
      selector.onSelect = done;
      selector.onCancel = () => done(null);

      return {
        render: (width) => selector.render(width),
        handleInput: (data) => {
          selector.handleInput(data);
          tui.requestRender();
        },
        invalidate: () => selector.invalidate(),
      };
    });

    if (selected !== null) {
      ctx.ui.notify(`Selected: ${selected}`, "info");
    }
  }
});
```

## 主题

组件通过主题对象进行样式设置。

**在 `renderCall`/`renderResult` 中**，使用 `theme` 参数：

```typescript
renderResult(result, options, theme, context) {
  // Use theme.fg() for foreground colors
  return new Text(theme.fg("success", "Done!"), 0, 0);
  
  // Use theme.bg() for background colors
  const styled = theme.bg("toolPendingBg", theme.fg("accent", "text"));
}
```

**前景色**（`theme.fg(color, text)`）：

| 类别 | 颜色 |
|----------|--------|
| 通用 | `text`、`accent`、`muted`、`dim` |
| 状态 | `success`、`error`、`warning` |
| 边框 | `border`、`borderAccent`、`borderMuted` |
| 消息 | `userMessageText`、`customMessageText`、`customMessageLabel` |
| 工具 | `toolTitle`、`toolOutput` |
| Diff | `toolDiffAdded`、`toolDiffRemoved`、`toolDiffContext` |
| Markdown | `mdHeading`、`mdLink`、`mdLinkUrl`、`mdCode`、`mdCodeBlock`、`mdCodeBlockBorder`、`mdQuote`、`mdQuoteBorder`、`mdHr`、`mdListBullet` |
| 语法 | `syntaxComment`、`syntaxKeyword`、`syntaxFunction`、`syntaxVariable`、`syntaxString`、`syntaxNumber`、`syntaxType`、`syntaxOperator`、`syntaxPunctuation` |
| 思考 | `thinkingOff`、`thinkingMinimal`、`thinkingLow`、`thinkingMedium`、`thinkingHigh`、`thinkingXhigh`、`thinkingMax` |
| 模式 | `bashMode` |

**背景色**（`theme.bg(color, text)`）：

`selectedBg`、`userMessageBg`、`customMessageBg`、`toolPendingBg`、`toolSuccessBg`、`toolErrorBg`

**对于 Markdown**，使用 `getMarkdownTheme()`：

```typescript
import { getMarkdownTheme } from "@earendil-works/pi-coding-agent";
import { Markdown } from "@earendil-works/pi-tui";

renderResult(result, options, theme, context) {
  const mdTheme = getMarkdownTheme();
  return new Markdown(result.details.markdown, 0, 0, mdTheme);
}
```

**对于自定义组件**，可定义自己的主题接口：

```typescript
interface MyTheme {
  selected: (s: string) => string;
  normal: (s: string) => string;
}
```

## 调试日志

设置 `PI_TUI_WRITE_LOG` 可捕获写入 stdout 的原始 ANSI 流。

```bash
PI_TUI_WRITE_LOG=/tmp/tui-ansi.log npx tsx packages/tui/test/chat-simple.ts
```

## 性能

尽可能缓存渲染输出：

```typescript
class CachedComponent {
  private cachedWidth?: number;
  private cachedLines?: string[];

  render(width: number): string[] {
    if (this.cachedLines && this.cachedWidth === width) {
      return this.cachedLines;
    }
    // ... compute lines ...
    this.cachedWidth = width;
    this.cachedLines = lines;
    return lines;
  }

  invalidate(): void {
    this.cachedWidth = undefined;
    this.cachedLines = undefined;
  }
}
```

状态变化时调用 `invalidate()`，然后使用注入的 `tui.requestRender()` 触发重新渲染。

## 失效与主题变更

主题变更时，TUI 会对所有组件调用 `invalidate()` 以清除缓存。组件必须正确实现 `invalidate()`，才能使主题变更生效。

### 问题

若组件预先把主题颜色烘焙进字符串（通过 `theme.fg()`、`theme.bg()` 等）并缓存，缓存字符串会包含旧主题的 ANSI 转义码。若组件还单独存储了带主题的内容，仅清除渲染缓存不够。

**错误做法**（主题颜色不会更新）：

```typescript
class BadComponent extends Container {
  private content: Text;

  constructor(message: string, theme: Theme) {
    super();
    // Pre-baked theme colors stored in Text component
    this.content = new Text(theme.fg("accent", message), 1, 0);
    this.addChild(this.content);
  }
  // No invalidate override - parent's invalidate only clears
  // child render caches, not the pre-baked content
}
```

### 解决方案

用主题颜色构建内容的组件，必须在调用 `invalidate()` 时重建该内容：

```typescript
class GoodComponent extends Container {
  private message: string;
  private content: Text;

  constructor(message: string) {
    super();
    this.message = message;
    this.content = new Text("", 1, 0);
    this.addChild(this.content);
    this.updateDisplay();
  }

  private updateDisplay(): void {
    // Rebuild content with current theme
    this.content.setText(theme.fg("accent", this.message));
  }

  override invalidate(): void {
    super.invalidate();  // Clear child caches
    this.updateDisplay(); // Rebuild with new theme
  }
}
```

### 模式：在 Invalidate 时重建

对于内容复杂的组件：

```typescript
class ComplexComponent extends Container {
  private data: SomeData;

  constructor(data: SomeData) {
    super();
    this.data = data;
    this.rebuild();
  }

  private rebuild(): void {
    this.clear();  // Remove all children

    // Build UI with current theme
    this.addChild(new Text(theme.fg("accent", theme.bold("Title")), 1, 0));
    this.addChild(new Spacer(1));

    for (const item of this.data.items) {
      const color = item.active ? "success" : "muted";
      this.addChild(new Text(theme.fg(color, item.label), 1, 0));
    }
  }

  override invalidate(): void {
    super.invalidate();
    this.rebuild();
  }
}
```

### 何时需要

以下情况需要该模式：

1. **预先烘焙主题颜色** - 使用 `theme.fg()` 或 `theme.bg()` 创建样式化字符串并存入子组件
2. **语法高亮** - 使用会应用基于主题的语法颜色的 `highlightCode()`
3. **复杂布局** - 构建嵌入主题颜色的子组件树

以下情况不需要：

1. **使用主题回调** - 传入在渲染时调用的函数，如 `(text) => theme.fg("accent", text)`
2. **简单容器** - 仅分组其他组件，不添加带主题内容
3. **无状态渲染** - 每次 `render()` 都重新计算带主题输出（无缓存）

## 常见模式

这些模式覆盖扩展中最常见的 UI 需求。**请复制这些模式，而不是从零构建。**

### 模式 1：选择对话框（SelectList）

让用户从选项列表中选择。使用 `@earendil-works/pi-tui` 的 `SelectList`，并以 `DynamicBorder` 作为边框。

```typescript
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { DynamicBorder } from "@earendil-works/pi-coding-agent";
import { Container, type SelectItem, SelectList, Text } from "@earendil-works/pi-tui";

pi.registerCommand("pick", {
  handler: async (_args, ctx) => {
    const items: SelectItem[] = [
      { value: "opt1", label: "Option 1", description: "First option" },
      { value: "opt2", label: "Option 2", description: "Second option" },
      { value: "opt3", label: "Option 3" },  // description is optional
    ];

    const result = await ctx.ui.custom<string | null>((tui, theme, _kb, done) => {
      const container = new Container();

      // Top border
      container.addChild(new DynamicBorder((s: string) => theme.fg("accent", s)));

      // Title
      container.addChild(new Text(theme.fg("accent", theme.bold("Pick an Option")), 1, 0));

      // SelectList with theme
      const selectList = new SelectList(items, Math.min(items.length, 10), {
        selectedPrefix: (t) => theme.fg("accent", t),
        selectedText: (t) => theme.fg("accent", t),
        description: (t) => theme.fg("muted", t),
        scrollInfo: (t) => theme.fg("dim", t),
        noMatch: (t) => theme.fg("warning", t),
      });
      selectList.onSelect = (item) => done(item.value);
      selectList.onCancel = () => done(null);
      container.addChild(selectList);

      // Help text
      container.addChild(new Text(theme.fg("dim", "↑↓ navigate • enter select • esc cancel"), 1, 0));

      // Bottom border
      container.addChild(new DynamicBorder((s: string) => theme.fg("accent", s)));

      return {
        render: (w) => container.render(w),
        invalidate: () => container.invalidate(),
        handleInput: (data) => { selectList.handleInput(data); tui.requestRender(); },
      };
    });

    if (result) {
      ctx.ui.notify(`Selected: ${result}`, "info");
    }
  },
});
```

**示例：** [preset.ts](../examples/extensions/preset.ts)、[tools.ts](../examples/extensions/tools.ts)

### 模式 2：可取消的异步操作（BorderedLoader）

适用于耗时且应可取消的操作。`BorderedLoader` 显示旋转指示器，并处理 Escape 以取消。

```typescript
import { BorderedLoader } from "@earendil-works/pi-coding-agent";

pi.registerCommand("fetch", {
  handler: async (_args, ctx) => {
    const result = await ctx.ui.custom<string | null>((tui, theme, _kb, done) => {
      const loader = new BorderedLoader(tui, theme, "Fetching data...");
      loader.onAbort = () => done(null);

      // Do async work
      fetchData(loader.signal)
        .then((data) => done(data))
        .catch(() => done(null));

      return loader;
    });

    if (result === null) {
      ctx.ui.notify("Cancelled", "info");
    } else {
      ctx.ui.setEditorText(result);
    }
  },
});
```

**示例：** [qna.ts](../examples/extensions/qna.ts)、[handoff.ts](../examples/extensions/handoff.ts)

### 模式 3：设置/开关（SettingsList）

用于切换多项设置。使用 `@earendil-works/pi-tui` 的 `SettingsList` 与 `getSettingsListTheme()`。

```typescript
import { getSettingsListTheme } from "@earendil-works/pi-coding-agent";
import { Container, type SettingItem, SettingsList, Text } from "@earendil-works/pi-tui";

pi.registerCommand("settings", {
  handler: async (_args, ctx) => {
    const items: SettingItem[] = [
      { id: "verbose", label: "Verbose mode", currentValue: "off", values: ["on", "off"] },
      { id: "color", label: "Color output", currentValue: "on", values: ["on", "off"] },
    ];

    await ctx.ui.custom((_tui, theme, _kb, done) => {
      const container = new Container();
      container.addChild(new Text(theme.fg("accent", theme.bold("Settings")), 1, 1));

      const settingsList = new SettingsList(
        items,
        Math.min(items.length + 2, 15),
        getSettingsListTheme(),
        (id, newValue) => {
          // Handle value change
          ctx.ui.notify(`${id} = ${newValue}`, "info");
        },
        () => done(undefined),  // On close
        { enableSearch: true }, // Optional: enable fuzzy search by label
      );
      container.addChild(settingsList);

      return {
        render: (w) => container.render(w),
        invalidate: () => container.invalidate(),
        handleInput: (data) => settingsList.handleInput?.(data),
      };
    });
  },
});
```

**示例：** [tools.ts](../examples/extensions/tools.ts)

### 模式 4：持久状态指示器

在页脚显示跨渲染持久的状态。适合模式指示。

```typescript
// Set status (shown in footer)
ctx.ui.setStatus("my-ext", ctx.ui.theme.fg("accent", "● active"));

// Clear status
ctx.ui.setStatus("my-ext", undefined);
```

**示例：** [status-line.ts](../examples/extensions/status-line.ts)、[plan-mode/index.ts](../examples/extensions/plan-mode/index.ts)、[preset.ts](../examples/extensions/preset.ts)

### 模式 4b：工作指示器自定义

自定义 pi 流式输出响应时显示的内联工作指示器。

```typescript
// Static indicator
ctx.ui.setWorkingIndicator({ frames: [ctx.ui.theme.fg("accent", "●")] });

// Custom animated indicator
ctx.ui.setWorkingIndicator({
  frames: [
    ctx.ui.theme.fg("dim", "·"),
    ctx.ui.theme.fg("muted", "•"),
    ctx.ui.theme.fg("accent", "●"),
    ctx.ui.theme.fg("muted", "•"),
  ],
  intervalMs: 120,
});

// Hide the indicator entirely
ctx.ui.setWorkingIndicator({ frames: [] });

// Restore pi's default spinner
ctx.ui.setWorkingIndicator();
```

这仅影响普通流式工作指示器。压缩与重试加载器仍使用其内置样式。自定义帧按原样渲染，因此扩展在需要时需自行添加颜色。

**示例：** [working-indicator.ts](../examples/extensions/working-indicator.ts)

### 模式 5：编辑器上方/下方的小组件

在输入编辑器上方或下方显示持久内容。适合待办列表、进度等。

```typescript
// Simple string array (above editor by default)
ctx.ui.setWidget("my-widget", ["Line 1", "Line 2"]);

// Render below the editor
ctx.ui.setWidget("my-widget", ["Line 1", "Line 2"], { placement: "belowEditor" });

// Or with theme
ctx.ui.setWidget("my-widget", (_tui, theme) => {
  const lines = items.map((item, i) =>
    item.done
      ? theme.fg("success", "✓ ") + theme.fg("muted", item.text)
      : theme.fg("dim", "○ ") + item.text
  );
  return {
    render: () => lines,
    invalidate: () => {},
  };
});

// Clear
ctx.ui.setWidget("my-widget", undefined);
```

**示例：** [plan-mode/index.ts](../examples/extensions/plan-mode/index.ts)

### 模式 6：自定义页脚

替换页脚。`footerData` 暴露扩展通常无法访问的数据。

```typescript
ctx.ui.setFooter((tui, theme, footerData) => ({
  invalidate() {},
  render(width: number): string[] {
    // footerData.getGitBranch(): string | null
    // footerData.getExtensionStatuses(): ReadonlyMap<string, string>
    return [`${ctx.model?.id} (${footerData.getGitBranch() || "no git"})`];
  },
  dispose: footerData.onBranchChange(() => tui.requestRender()), // reactive
}));

ctx.ui.setFooter(undefined); // restore default
```

令牌统计可通过 `ctx.sessionManager.getBranch()` 与 `ctx.model` 获取。

**示例：** [custom-footer.ts](../examples/extensions/custom-footer.ts)

### 模式 7：自定义编辑器（vim 模式等）

用自定义实现替换主输入编辑器。适用于模态编辑（vim）、不同键绑定（emacs）或专用输入处理。

```typescript
import { CustomEditor, type ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { matchesKey, truncateToWidth } from "@earendil-works/pi-tui";

type Mode = "normal" | "insert";

class VimEditor extends CustomEditor {
  private mode: Mode = "insert";

  handleInput(data: string): void {
    // Escape: switch to normal mode, or pass through for app handling
    if (matchesKey(data, "escape")) {
      if (this.mode === "insert") {
        this.mode = "normal";
        return;
      }
      // In normal mode, escape aborts agent (handled by CustomEditor)
      super.handleInput(data);
      return;
    }

    // Insert mode: pass everything to CustomEditor
    if (this.mode === "insert") {
      super.handleInput(data);
      return;
    }

    // Normal mode: vim-style navigation
    switch (data) {
      case "i": this.mode = "insert"; return;
      case "h": super.handleInput("\x1b[D"); return; // Left
      case "j": super.handleInput("\x1b[B"); return; // Down
      case "k": super.handleInput("\x1b[A"); return; // Up
      case "l": super.handleInput("\x1b[C"); return; // Right
    }
    // Pass unhandled keys to super (ctrl+c, etc.), but filter printable chars
    if (data.length === 1 && data.charCodeAt(0) >= 32) return;
    super.handleInput(data);
  }

  render(width: number): string[] {
    const lines = super.render(width);
    // Add mode indicator to bottom border (use truncateToWidth for ANSI-safe truncation)
    if (lines.length > 0) {
      const label = this.mode === "normal" ? " NORMAL " : " INSERT ";
      const lastLine = lines[lines.length - 1]!;
      // Pass "" as ellipsis to avoid adding "..." when truncating
      lines[lines.length - 1] = truncateToWidth(lastLine, width - label.length, "") + label;
    }
    return lines;
  }
}

export default function (pi: ExtensionAPI) {
  pi.on("session_start", (_event, ctx) => {
    // Factory receives the TUI, theme, and keybindings from the app
    ctx.ui.setEditorComponent((tui, theme, keybindings) =>
      new VimEditor(tui, theme, keybindings)
    );
  });
}
```

**要点：**

- **继承 `CustomEditor`**（而非基类 `Editor`），以获得应用键绑定（Escape 中止、Ctrl+D 退出、模型切换等）
- **对未处理的按键调用 `super.handleInput(data)`**
- **工厂模式**：`setEditorComponent` 接收工厂函数，并传入 `tui`、`theme` 与 `keybindings`
- **传入 `undefined`** 可恢复默认编辑器：`ctx.ui.setEditorComponent(undefined)`

**示例：** [modal-editor.ts](../examples/extensions/modal-editor.ts)

## 关键规则

1. **始终使用回调中的 theme** - 不要直接导入主题。使用 `ctx.ui.custom((tui, theme, keybindings, done) => ...)` 回调中的 `theme`。

2. **始终为 DynamicBorder 颜色参数标注类型** - 写 `(s: string) => theme.fg("accent", s)`，不要写 `(s) => theme.fg("accent", s)`。

3. **状态变更后调用 tui.requestRender()** - 在 `handleInput` 中更新状态后调用 `tui.requestRender()`。

4. **返回三方法对象** - 自定义组件需要 `{ render, invalidate, handleInput }`。

5. **使用现有组件** - `SelectList`、`SettingsList`、`BorderedLoader` 覆盖约 90% 的场景。不要重新实现它们。

## 示例

- **选择 UI**：[examples/extensions/preset.ts](../examples/extensions/preset.ts) - 带 DynamicBorder 边框的 SelectList
- **可取消异步**：[examples/extensions/qna.ts](../examples/extensions/qna.ts) - 用于 LLM 调用的 BorderedLoader
- **设置开关**：[examples/extensions/tools.ts](../examples/extensions/tools.ts) - 用于启用/禁用工具的 SettingsList
- **状态指示**：[examples/extensions/plan-mode/index.ts](../examples/extensions/plan-mode/index.ts) - setStatus 与 setWidget
- **工作指示器**：[examples/extensions/working-indicator.ts](../examples/extensions/working-indicator.ts) - setWorkingIndicator
- **自定义页脚**：[examples/extensions/custom-footer.ts](../examples/extensions/custom-footer.ts) - 带统计的 setFooter
- **自定义编辑器**：[examples/extensions/modal-editor.ts](../examples/extensions/modal-editor.ts) - 类 Vim 的模态编辑
- **贪吃蛇游戏**：[examples/extensions/snake.ts](../examples/extensions/snake.ts) - 完整游戏，含键盘输入与游戏循环
- **自定义工具渲染**：[examples/extensions/todo.ts](../examples/extensions/todo.ts) - renderCall 与 renderResult
