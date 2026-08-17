# @earendil-works/pi-tui

具备差分渲染与同步输出的精简终端 UI 框架，用于无闪烁的交互式 CLI 应用。

## 功能特性

- **可互换的渲染器**：共享 `TUI` 接口，提供主屏幕与备用屏幕实现
- **差分渲染**：仅更新发生变化的行或视口行
- **应用自管滚动**：备用屏幕视口支持鼠标、触控板与键盘导航
- **同步输出**：使用 CSI 2026 实现原子屏幕更新（无闪烁）
- **括号粘贴模式**：正确处理大段粘贴，超过 10 行时使用标记
- **基于组件**：简单的 Component 接口，提供 render() 方法
- **主题支持**：组件接受主题接口以实现可定制样式
- **内置组件**：Text、TruncatedText、Input、Editor、Markdown、Loader、SelectList、SettingsList、Spacer、Image、Box、Container、VStack、HStack、ScrollView
- **行内图片**：在支持 Kitty 或 iTerm2 图形协议的终端中渲染图片
- **自动补全支持**：文件路径与斜杠命令

## 快速开始

```typescript
import { type TUI, Text, Editor, ProcessTerminal, TuiMainScreen, matchesKey } from "@earendil-works/pi-tui";

// Create terminal
const terminal = new ProcessTerminal();

// Create the default main-screen renderer through the shared TUI interface
const tui: TUI = new TuiMainScreen(terminal);

// Add components
tui.addChild(new Text("Welcome to my app!"));

import { defaultEditorTheme as editorTheme } from './test/test-themes.ts';
const editor = new Editor(tui, editorTheme);
editor.onSubmit = (text) => {
  console.log("Submitted:", text);
  tui.addChild(new Text(`You said: ${text}`));
};
tui.addChild(editor);

// Focus the editor so it receives keyboard input
tui.setFocus(editor);

// In raw mode Ctrl+C doesn't send SIGINT — intercept it here to allow exit
tui.addInputListener((data) => {
  if (matchesKey(data, 'ctrl+c')) {
    tui.stop();
    process.exit(0);
  }
});

// Start
tui.start();
```

## 核心 API

### TUI 接口与渲染器

`TUI` 是组件管理、焦点、叠加层、输入、生命周期、终端查询与渲染的共享接口。仅在构造应用时选择具体渲染器：

- `TuiMainScreen` 渲染到主终端缓冲区，并保留终端回滚历史（scrollback）。
- `TuiAltScreen` 在备用终端缓冲区中渲染固定高度视口，并由应用自行管理滚动。停止时，它会恢复主缓冲区并打印完整的最终文档。

```typescript
import { type TUI, TuiAltScreen, TuiMainScreen } from "@earendil-works/pi-tui";

const tui: TUI = new TuiMainScreen(terminal);
// To use an application-owned viewport in the alternate terminal buffer instead:
// const tui: TUI = new TuiAltScreen(terminal);

tui.addChild(component);
tui.removeChild(component);
tui.start();
tui.stop();
tui.requestRender(); // Request a re-render

// Global debug key handler (Shift+Ctrl+D)
tui.onDebug = () => console.log("Debug triggered");
```

### 备用屏幕视口布局

`TuiAltScreen` 可以渲染明确按终端高度约束的布局。`VStack` 与 `HStack` 分配受限区域，而 `ScrollView` 负责某一区域的滚动。这些语义在 `TuiMainScreen` 上刻意不可用，因为那里由终端拥有 scrollback。

```typescript
import {
  Container,
  isViewportTUI,
  ScrollView,
  Text,
  VStack,
} from "@earendil-works/pi-tui";

const transcript = new Container();
transcript.addChild(new Text("History"));

const editorAndFooter = new VStack([
  editor,
  new Text("status"),
]);

if (isViewportTUI(tui)) {
  tui.setLayoutRoot(new VStack([
    {
      component: new ScrollView(transcript, {
        follow: "end",
        primary: true,
        overscroll: "chain",
      }),
      basis: 0,
      grow: 1,
      minSize: 1,
    },
    {
      component: editorAndFooter,
      basis: "auto",
      shrink: 1,
      minSize: 1,
    },
  ]));
}
```

Stack 条目支持 `basis`、`grow`、`shrink`、`minSize`、`maxSize`，以及响应式的 `visible` 回调。鼠标滚轮输入默认指向指针下方的 scroll view，未用完的增量会链式传递到外层 scroll view。主 scroll view 会接收备用屏幕的键盘导航动作，以及悬停在非可滚动区域上的滚轮输入。它还可以在 OSC 133 语义提示符标记之间跳转，与常见终端提示符导航快捷键一致。

布局几何会在每个请求的帧中重建。有状态组件会被保留，其已有的渲染行缓存仍然有效。直接对这些布局组件调用 `render(width)` 会生成无界文档，这也用于备用模式恢复主屏幕时。

### 叠加层（Overlays）

叠加层在现有内容之上渲染组件而不替换它。适用于对话框、菜单与模态 UI。

```typescript
// Show overlay with default options (centered, max 80 cols)
const handle = tui.showOverlay(component);

// Show overlay with custom positioning and sizing
// Values can be numbers (absolute) or percentage strings (e.g., "50%")
const handle = tui.showOverlay(component, {
  // Sizing
  width: 60,              // Fixed width in columns
  width: "80%",           // Width as percentage of terminal
  minWidth: 40,           // Minimum width floor
  maxHeight: 20,          // Maximum height in rows
  maxHeight: "50%",       // Maximum height as percentage of terminal

  // Anchor-based positioning (default: 'center')
  anchor: 'bottom-right', // Position relative to anchor point
  offsetX: 2,             // Horizontal offset from anchor
  offsetY: -1,            // Vertical offset from anchor

  // Percentage-based positioning (alternative to anchor)
  row: "25%",             // Vertical position (0%=top, 100%=bottom)
  col: "50%",             // Horizontal position (0%=left, 100%=right)

  // Absolute positioning (overrides anchor/percent)
  row: 5,                 // Exact row position
  col: 10,                // Exact column position

  // Margin from terminal edges
  margin: 2,              // All sides
  margin: { top: 1, right: 2, bottom: 1, left: 2 },

  // Responsive visibility
  visible: (termWidth, termHeight) => termWidth >= 100  // Hide on narrow terminals

  // Focus behavior
  nonCapturing: true       // Don't auto-focus when shown
});

// OverlayHandle methods
handle.hide();              // Permanently remove the overlay
handle.setHidden(true);     // Temporarily hide (can show again)
handle.setHidden(false);    // Show again after hiding
handle.isHidden();          // Check if temporarily hidden
handle.focus();             // Focus and bring to visual front
handle.unfocus();           // Release focus to normal fallback
handle.unfocus({ target: baseComponent }); // Release this overlay to a specific component
handle.unfocus({ target: null });   // Release this overlay and leave focus empty
handle.isFocused();         // Check if overlay has focus

handle.unfocus();
// Overlay loses focus; TUI falls back to another visible capturing overlay or the previous focus target.

handle.unfocus({ target: null });
// Overlay loses focus; no component receives input until focus is set again.

// A focused visible overlay reclaims keyboard input after temporary replacement UI
// releases focus. If you want a specific component to receive input while overlays remain
// visible, call handle.unfocus({ target: component }).

// Hide topmost overlay
tui.hideOverlay();

// Check if any visible overlay is active
tui.hasOverlay();
```

**锚点值**：`'center'`、`'top-left'`、`'top-right'`、`'bottom-left'`、`'bottom-right'`、`'top-center'`、`'bottom-center'`、`'left-center'`、`'right-center'`

**解析顺序**：
1. 在宽度计算之后，`minWidth` 作为下限应用
2. 对于位置：绝对 `row`/`col` > 百分比 `row`/`col` > `anchor`
3. `margin` 会钳制最终位置，使其保持在终端边界内
4. `visible` 回调控制叠加层是否渲染（每帧调用）

### Component 接口

所有组件实现：

```typescript
interface Component {
  render(width: number): string[];
  handleInput?(data: string): void;
  invalidate?(): void;
}
```

| 方法 | 说明 |
|--------|-------------|
| `render(width)` | 返回字符串数组，每行一个。每行**不得超过 `width`**，否则 TUI 会报错。使用 `truncateToWidth()` 或手动换行来确保这一点。 |
| `handleInput?(data)` | 当组件拥有焦点并收到键盘输入时调用。`data` 字符串包含原始终端输入（可能包含 ANSI 转义序列）。 |
| `invalidate?()` | 用于清除任何缓存的渲染状态。组件应在下一次 `render()` 调用时从头重新渲染。 |

TUI 会在每一渲染行末尾追加完整的 SGR 重置与 OSC 8 重置。样式不会跨行延续。如果发出带样式的多行文本，请按行重新应用样式，或使用 `wrapTextWithAnsi()`，以便每条换行后的行都保留样式。

### Focusable 接口（IME 支持）

显示文本光标并需要 IME（输入法编辑器）支持的组件应实现 `Focusable` 接口：

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

当 `Focusable` 组件拥有焦点时，TUI 会：
1. 在组件上将 `focused = true`
2. 扫描渲染输出中的 `CURSOR_MARKER`（零宽度 APC 转义序列）
3. 将硬件终端光标定位到该位置
4. 仅在启用 `showHardwareCursor` 时显示硬件光标

默认情况下光标保持隐藏。这样可保留假光标渲染，同时仍为那些在隐藏光标时跟踪 IME 候选窗口的终端定位硬件光标。部分终端需要可见的硬件光标才能正确定位 IME；可通过渲染器构造函数的 `showHardwareCursor` 参数、`setShowHardwareCursor(true)` 或 `PI_HARDWARE_CURSOR=1` 启用。内置的 `Editor` 与 `Input` 组件已实现该接口。

**包含嵌入式输入的容器组件：** 当容器组件（对话框、选择器等）包含 `Input` 或 `Editor` 子组件时，容器必须实现 `Focusable`，并将焦点状态传播给子组件：

```typescript
import { Container, type Focusable, Input } from "@earendil-works/pi-tui";

class SearchDialog extends Container implements Focusable {
  private searchInput: Input;

  // Propagate focus to child input for IME cursor positioning
  private _focused = false;
  get focused(): boolean { return this._focused; }
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

若不进行此传播，使用 IME（中文、日文、韩文等）输入时，候选窗口会显示在错误位置。

## 内置组件

### Container

对子组件进行分组。

```typescript
const container = new Container();
container.addChild(component);
container.removeChild(component);
```

### Box

对所有子组件应用内边距与背景色的容器。

```typescript
const box = new Box(
  1,                              // paddingX (default: 1)
  1,                              // paddingY (default: 1)
  (text) => chalk.bgGray(text)   // optional background function
);
box.addChild(new Text("Content"));
box.setBgFn((text) => chalk.bgBlue(text));  // Change background dynamically
```

### Text

显示带自动换行与内边距的多行文本。

```typescript
const text = new Text(
  "Hello World",                  // text content
  1,                              // paddingX (default: 1)
  1,                              // paddingY (default: 1)
  (text) => chalk.bgGray(text)   // optional background function
);
text.setText("Updated text");
text.setCustomBgFn((text) => chalk.bgBlue(text));
```

### TruncatedText

截断以适应视口宽度的单行文本。适用于状态行与标题。

```typescript
const truncated = new TruncatedText(
  "This is a very long line that will be truncated...",
  0,  // paddingX (default: 0)
  0   // paddingY (default: 0)
);
```

### Input

带水平滚动的单行文本输入。

```typescript
const input = new Input();
input.onSubmit = (value) => console.log(value);
input.setValue("initial");
input.getValue();
```

**快捷键：**
- `Enter` - 提交
- `Ctrl+A` / `Ctrl+E` - 行首/行尾
- `Ctrl+W` 或 `Alt+Backspace` - 向后删除单词
- `Ctrl+U` - 删除到行首
- `Ctrl+K` - 删除到行尾
- `Ctrl+Left` / `Ctrl+Right` - 按词导航
- `Alt+Left` / `Alt+Right` - 按词导航
- 方向键、Backspace、Delete 按预期工作

### Editor

多行文本编辑器，支持自动补全、文件补全、粘贴处理，以及内容超过终端高度时的垂直滚动。

```typescript
interface EditorTheme {
  borderColor: (str: string) => string;
  selectList: SelectListTheme;
}

interface EditorOptions {
  paddingX?: number;  // Horizontal padding (default: 0)
}

const editor = new Editor(tui, theme, options?);  // tui is required for height-aware scrolling
editor.onSubmit = (text) => console.log(text);
editor.onChange = (text) => console.log("Changed:", text);
editor.disableSubmit = true; // Disable submit temporarily
editor.setAutocompleteProvider(provider);
editor.borderColor = (s) => chalk.blue(s); // Change border dynamically
editor.setPaddingX(1); // Update horizontal padding dynamically
editor.getPaddingX();  // Get current padding
```

**功能：**
- 带自动换行的多行编辑
- 斜杠命令自动补全（输入 `/`）
- 文件路径自动补全（按 `Tab`）
- 大段粘贴处理（超过 10 行会创建 `[paste #1 +50 lines]` 标记）
- 编辑器上下的水平分隔线
- 假光标渲染（隐藏真实光标）

**快捷键：**
- `Enter` - 提交
- `Shift+Enter`、`Ctrl+Enter` 或 `Alt+Enter` - 换行（取决于终端，Alt+Enter 最可靠）
- `Tab` - 自动补全
- `Ctrl+K` - 删除到行尾
- `Ctrl+U` - 删除到行首
- `Ctrl+W` 或 `Alt+Backspace` - 向后删除单词
- `Alt+D` 或 `Alt+Delete` - 向前删除单词
- `Ctrl+A` / `Ctrl+E` - 行首/行尾
- `Ctrl+]` - 向前跳转到字符（等待下一次按键，然后将光标移到首次出现处）
- `Ctrl+Alt+]` - 向后跳转到字符
- 方向键、Backspace、Delete 按预期工作

### Markdown

渲染带语法高亮与主题支持的 markdown。

```typescript
interface MarkdownTheme {
  heading: (text: string) => string;
  link: (text: string) => string;
  linkUrl: (text: string) => string;
  code: (text: string) => string;
  codeBlock: (text: string) => string;
  codeBlockBorder: (text: string) => string;
  quote: (text: string) => string;
  quoteBorder: (text: string) => string;
  hr: (text: string) => string;
  listBullet: (text: string) => string;
  bold: (text: string) => string;
  italic: (text: string) => string;
  strikethrough: (text: string) => string;
  underline: (text: string) => string;
  highlightCode?: (code: string, lang?: string) => string[];
}

interface DefaultTextStyle {
  color?: (text: string) => string;
  bgColor?: (text: string) => string;
  bold?: boolean;
  italic?: boolean;
  strikethrough?: boolean;
  underline?: boolean;
}

const md = new Markdown(
  "# Hello\n\nSome **bold** text",
  1,              // paddingX
  1,              // paddingY
  theme,          // MarkdownTheme
  defaultStyle    // optional DefaultTextStyle
);
md.setText("Updated markdown");
```

**功能：**
- 标题、粗体、斜体、代码块、列表、链接、引用块
- HTML 标签按纯文本渲染
- 通过 `highlightCode` 提供可选语法高亮
- 内边距支持
- 为性能提供渲染缓存

### Loader

动画加载旋转指示器。

```typescript
const loader = new Loader(
  tui,                              // TUI instance for render updates
  (s) => chalk.cyan(s),            // spinner color function
  (s) => chalk.gray(s),            // message color function
  "Loading..."                      // message (default: "Loading...")
);
loader.start();
loader.setMessage("Still loading...");
loader.stop();
```

### CancellableLoader

扩展 Loader，支持 Escape 键处理与 AbortSignal，用于取消异步操作。

```typescript
const loader = new CancellableLoader(
  tui,                              // TUI instance for render updates
  (s) => chalk.cyan(s),            // spinner color function
  (s) => chalk.gray(s),            // message color function
  "Working..."                      // message
);
loader.onAbort = () => done(null); // Called when user presses Escape
doAsyncWork(loader.signal).then(done);
```

**属性：**
- `signal: AbortSignal` - 用户按下 Escape 时中止
- `aborted: boolean` - 加载器是否已被中止
- `onAbort?: () => void` - 用户按下 Escape 时的回调

### SelectList

带键盘导航的交互式选择列表。

```typescript
interface SelectItem {
  value: string;
  label: string;
  description?: string;
}

interface SelectListTheme {
  selectedPrefix: (text: string) => string;
  selectedText: (text: string) => string;
  description: (text: string) => string;
  scrollInfo: (text: string) => string;
  noMatch: (text: string) => string;
}

const list = new SelectList(
  [
    { value: "opt1", label: "Option 1", description: "First option" },
    { value: "opt2", label: "Option 2", description: "Second option" },
  ],
  5,      // maxVisible
  theme   // SelectListTheme
);

list.onSelect = (item) => console.log("Selected:", item);
list.onCancel = () => console.log("Cancelled");
list.onSelectionChange = (item) => console.log("Highlighted:", item);
list.setFilter("opt"); // Filter items
```

**控件：**
- 方向键：导航
- Enter：选择
- Escape：取消

### SettingsList

带值循环与子菜单的设置面板。

```typescript
interface SettingItem {
  id: string;
  label: string;
  description?: string;
  currentValue: string;
  values?: string[];  // If provided, Enter/Space cycles through these
  submenu?: (currentValue: string, done: (selectedValue?: string) => void) => Component;
}

interface SettingsListTheme {
  label: (text: string, selected: boolean) => string;
  value: (text: string, selected: boolean) => string;
  description: (text: string) => string;
  cursor: string;
  hint: (text: string) => string;
}

const settings = new SettingsList(
  [
    { id: "theme", label: "Theme", currentValue: "dark", values: ["dark", "light"] },
    { id: "model", label: "Model", currentValue: "gpt-4", submenu: (val, done) => modelSelector },
  ],
  10,      // maxVisible
  theme,   // SettingsListTheme
  (id, newValue) => console.log(`${id} changed to ${newValue}`),
  () => console.log("Cancelled")
);
settings.updateValue("theme", "light");
```

**控件：**
- 方向键：导航
- Enter/Space：激活（循环值或打开子菜单）
- Escape：取消

### Spacer

用于垂直间距的空行。

```typescript
const spacer = new Spacer(2); // 2 empty lines (default: 1)
```

### Image

在支持 Kitty 图形协议（Kitty、Ghostty、WezTerm）或 iTerm2 行内图片的终端中行内渲染图片。在不支持的终端上回退为文本占位符。

```typescript
interface ImageTheme {
  fallbackColor: (str: string) => string;
}

interface ImageOptions {
  maxWidthCells?: number;
  maxHeightCells?: number;
  filename?: string;
}

const image = new Image(
  base64Data,       // base64-encoded image data
  "image/png",      // MIME type
  theme,            // ImageTheme
  options           // optional ImageOptions
);
tui.addChild(image);
```

支持的格式：PNG、JPEG、GIF、WebP。尺寸会自动从图片头解析。

#### 备用屏幕图片兼容性

`TuiAltScreen` 在实现 Kitty 图形协议的终端（包括 Kitty 与 Ghostty）中支持行内图片与部分视口裁剪。iTerm2 的行内图片协议不提供删除既有 placement 或在滚动时裁剪其源的操作。为防止陈旧图片残留在重绘内容之上，`TuiAltScreen` 在 iTerm2 中将图片组件渲染为文本占位符。`TuiMainScreen` 继续正常渲染 iTerm2 行内图片。

## 自动补全

### CombinedAutocompleteProvider

同时支持斜杠命令与文件路径。

```typescript
import { CombinedAutocompleteProvider } from "@earendil-works/pi-tui";

const provider = new CombinedAutocompleteProvider(
  [
    { name: "help", description: "Show help" },
    { name: "clear", description: "Clear screen" },
    { name: "delete", description: "Delete last message" },
  ],
  process.cwd() // base path for file completion
);

editor.setAutocompleteProvider(provider);
```

**功能：**
- 输入 `/` 查看斜杠命令
- 按 `Tab` 进行文件路径补全
- 支持 `~/`、`./`、`../` 与 `@` 前缀
- 对 `@` 前缀筛选为可附加文件

## 按键检测

使用 `matchesKey()` 与 `Key` 辅助工具检测键盘输入（支持 Kitty 键盘协议）：

```typescript
import { matchesKey, Key } from "@earendil-works/pi-tui";

if (matchesKey(data, Key.ctrl("c"))) {
  process.exit(0);
}

if (matchesKey(data, Key.enter)) {
  submit();
} else if (matchesKey(data, Key.escape)) {
  cancel();
} else if (matchesKey(data, Key.up)) {
  moveUp();
}
```

**按键标识符**（使用 `Key.*` 获得自动补全，或使用字符串字面量）：
- 基本键：`Key.enter`、`Key.escape`、`Key.tab`、`Key.space`、`Key.backspace`、`Key.delete`、`Key.home`、`Key.end`
- 方向键：`Key.up`、`Key.down`、`Key.left`、`Key.right`
- 带修饰键：`Key.ctrl("c")`、`Key.shift("tab")`、`Key.alt("left")`、`Key.ctrlShift("p")`
- 字符串格式也可：`"enter"`、`"ctrl+c"`、`"shift+tab"`、`"ctrl+shift+p"`

## 渲染模式

`TuiMainScreen` 使用三种渲染策略：

1. **首次渲染**：输出所有行，不清除 scrollback
2. **宽度变化或视口上方发生变化**：清屏并完整重新渲染
3. **正常更新**：将光标移到第一个变化行，清除到末尾，并渲染变化的行

`TuiAltScreen` 拥有终端高度的视口。没有显式布局根时，它保留旧的单文档滚动行为。使用 `setLayoutRoot()` 后，`VStack`、`HStack` 与嵌套的 `ScrollView` 组件可以预留固定区域，并独立滚动受限区域。它就地更新变化的视口行，在位于底部时跟随流式输出，并在内容增长时保留手动选择的滚动位置。鼠标滚轮与可配置的键盘导航会滚动而不修改终端 scrollback，包括在 OSC 133 语义提示符标记之间跳转。点击 OSC 8 超链接会使用配置的 URL 处理器打开它。用主鼠标按钮拖动可选择文本，并通过 OSC 52 复制到剪贴板；在 scroll view 的顶部或底部边缘按住拖动会自动滚动，并将选择扩展到屏幕外内容。Kitty 图片支持垂直视口裁剪；iTerm2 行内图片回退为文本，因为 iTerm2 协议无法在视口重绘期间删除或裁剪 placement。

两种渲染器都将更新包裹在**同步输出**（`\x1b[?2026h` ... `\x1b[?2026l`）中，以实现原子、无闪烁渲染。

## Terminal 接口

TUI 可与任何实现 `Terminal` 接口的对象配合使用：

```typescript
interface Terminal {
  start(onInput: (data: string) => void, onResize: () => void): void;
  stop(): void;
  write(data: string): void;
  get columns(): number;
  get rows(): number;
  moveBy(lines: number): void;
  hideCursor(): void;
  showCursor(): void;
  clearLine(): void;
  clearFromCursor(): void;
  clearScreen(): void;
}
```

**内置实现：**
- `ProcessTerminal` - 使用 `process.stdin/stdout`
- `VirtualTerminal` - 用于测试（使用 `@xterm/headless`）

## 工具函数

```typescript
import { visibleWidth, truncateToWidth, wrapTextWithAnsi } from "@earendil-works/pi-tui";

// Get visible width of string (ignoring ANSI codes)
const width = visibleWidth("\x1b[31mHello\x1b[0m"); // 5

// Truncate string to width (preserving ANSI codes, adds ellipsis)
const truncated = truncateToWidth("Hello World", 8); // "Hello..."

// Truncate without ellipsis
const truncatedNoEllipsis = truncateToWidth("Hello World", 8, ""); // "Hello Wo"

// Wrap text to width (preserving ANSI codes across line breaks)
const lines = wrapTextWithAnsi("This is a long line that needs wrapping", 20);
// ["This is a long line", "that needs wrapping"]
```

## 创建自定义组件

创建自定义组件时，**`render()` 返回的每一行都不得超过 `width` 参数**。若任一行宽于终端，TUI 会报错。

### 处理输入

使用 `matchesKey()` 与 `Key` 辅助工具处理键盘输入：

```typescript
import { matchesKey, Key, truncateToWidth } from "@earendil-works/pi-tui";
import type { Component } from "@earendil-works/pi-tui";

class MyInteractiveComponent implements Component {
  private selectedIndex = 0;
  private items = ["Option 1", "Option 2", "Option 3"];
  
  public onSelect?: (index: number) => void;
  public onCancel?: () => void;

  handleInput(data: string): void {
    if (matchesKey(data, Key.up)) {
      this.selectedIndex = Math.max(0, this.selectedIndex - 1);
    } else if (matchesKey(data, Key.down)) {
      this.selectedIndex = Math.min(this.items.length - 1, this.selectedIndex + 1);
    } else if (matchesKey(data, Key.enter)) {
      this.onSelect?.(this.selectedIndex);
    } else if (matchesKey(data, Key.escape) || matchesKey(data, Key.ctrl("c"))) {
      this.onCancel?.();
    }
  }

  render(width: number): string[] {
    return this.items.map((item, i) => {
      const prefix = i === this.selectedIndex ? "> " : "  ";
      return truncateToWidth(prefix + item, width);
    });
  }
}
```

### 处理行宽

使用提供的工具函数确保行宽合适：

```typescript
import { visibleWidth, truncateToWidth } from "@earendil-works/pi-tui";
import type { Component } from "@earendil-works/pi-tui";

class MyComponent implements Component {
  private text: string;

  constructor(text: string) {
    this.text = text;
  }

  render(width: number): string[] {
    // Option 1: Truncate long lines
    return [truncateToWidth(this.text, width)];

    // Option 2: Check and pad to exact width
    const line = this.text;
    const visible = visibleWidth(line);
    if (visible > width) {
      return [truncateToWidth(line, width)];
    }
    // Pad to exact width (optional, for backgrounds)
    return [line + " ".repeat(width - visible)];
  }
}
```

### ANSI 代码注意事项

`visibleWidth()` 与 `truncateToWidth()` 都能正确处理 ANSI 转义码：

- `visibleWidth()` 在计算宽度时忽略 ANSI 码
- `truncateToWidth()` 保留 ANSI 码，并在截断时正确闭合它们

```typescript
import chalk from "chalk";

const styled = chalk.red("Hello") + " " + chalk.blue("World");
const width = visibleWidth(styled); // 11 (not counting ANSI codes)
const truncated = truncateToWidth(styled, 8); // Red "Hello" + " W..." with proper reset
```

### 缓存

为提高性能，组件应缓存其渲染输出，并仅在必要时重新渲染：

```typescript
class CachedComponent implements Component {
  private text: string;
  private cachedWidth?: number;
  private cachedLines?: string[];

  render(width: number): string[] {
    if (this.cachedLines && this.cachedWidth === width) {
      return this.cachedLines;
    }

    const lines = [truncateToWidth(this.text, width)];

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

## 示例

参见 `test/chat-simple.ts`，这是一个完整的聊天界面示例，包含：
- 带自定义背景色的 Markdown 消息
- 响应期间的加载旋转指示器
- 带自动补全与斜杠命令的 Editor
- 消息之间的 Spacer

运行：
```bash
npx tsx test/chat-simple.ts
```

## 开发

```bash
# Install dependencies (from monorepo root)
npm install

# Run type checking
npm run check

# Run the demo
npx tsx test/chat-simple.ts
```

### 调试日志

设置 `PI_TUI_WRITE_LOG` 以捕获写入 stdout 的原始 ANSI 流。

```bash
PI_TUI_WRITE_LOG=/tmp/tui-ansi.log npx tsx test/chat-simple.ts
```
