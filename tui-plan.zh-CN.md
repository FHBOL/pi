# 备用屏幕（Alternate-Screen）布局系统方案

## 目的

为实现 `TuiAltScreen` 设计一套受约束的布局系统，并据此让 coding-agent 的 transcript 可滚动，同时使 pending / status / widget / editor / footer 区域固定在底部。

本文档是实现交接说明。它记录设计讨论中已做出的决策；除非实现过程中的发现要求重新审视某项决策，否则应将其视为既定范围。

## 核心决策

1. 受约束布局系统是备用屏幕（alternate-screen）功能。
2. `TuiMainScreen` 继续沿用其现有的终端回滚（scrollback）渲染模型。
3. 交互模式使用两种不同的组合方式，但共享相同的组件实例与行为。
4. 首批公开的布局原语为：
   - `VStack`
   - `HStack`
   - `ScrollView`
   - 现有 overlays
5. 帧级布局树是内部实现。API 用户构建组件树，从不直接操作 layout boxes、矩形、命中测试节点或滚动祖先链。
6. 每次请求渲染时重建内部布局树。不要重建组件状态。
7. 依赖现有叶子渲染缓存，尤其是 `Markdown`、`Text`、`Image` 和 `Box`。初期不要引入第二套框架级渲染缓存。
8. `Editor` 目前不缓存其渲染行，但它体积小且活跃；预计不会成为主要开销。
9. 保持 `interactive-mode.ts` 的改动声明式且最小。布局、裁剪、滚动、命中测试与事件路由应归属 `packages/tui`。
10. 鼠标滚轮支持是增强项。可配置的键盘滚动必须始终可用。

## 为何主屏幕与备用屏幕布局不同

在主屏幕模式下，滚动由终端掌控。应用无法可靠地提供：

- 粘性行（sticky rows）
- 可独立滚动的嵌套区域
- 全高并排窗格
- 对已进入终端 scrollback 的内容做可靠的鼠标命中测试
- 在不重放或清空 scrollback 的情况下，对屏外区域做任意重绘

因此，不要假装 `TuiMainScreen` 具备相同的受约束视口语义。

主屏幕交互模式仍然是一个纵向渲染的文档：

```text
header
loaded resources
chat
pending messages
status
widgets above
editor / replacement UI
widgets below
footer
```

备用屏幕交互模式变为：

```text
┌─────────────────────────────────────────────┐
│ scrollable transcript                       │
│                                             │
│ header                                      │
│ loaded resources                            │
│ chat/messages/tool output                   │
│                                             │
├─────────────────────────────────────────────┤
│ pending messages                            │
│ working/retry/compaction status             │
│ widgets above editor                        │
│ editor or temporary replacement UI          │
│ widgets below editor                        │
│ footer                                      │
└─────────────────────────────────────────────┘
```

Pending messages 与 status 属于固定区域。用户在阅读较早输出时隐藏活动队列/工作状态会令人意外。

## 目标

### 首次实现的硬性要求

- `TuiAltScreen` 中的受约束根布局。
- 纵向与横向 stack 布局。
- 带 follow-end 行为的纵向滚动。
- coding-agent 的粘性底部 dock。
- 现有的鼠标滚轮与键盘 transcript 滚动。
- 基于指针下方区域的滚轮路由。
- 嵌套 scroll view 的滚动连锁（scroll chaining）。
- 现有 overlay 渲染必须继续可用。
- 现有光标定位与 IME 支持必须继续可用。
- 现有超链接点击与鼠标文本选择必须继续可用。
- 现有 Kitty 图像行为在 transcript 用例下不得回退。
- `TuiMainScreen` 的行为与输出顺序必须保持不变。
- 离开 alt 模式时仍须打印完整的逻辑最终文档。

### 设计所启用的未来用途

- 宽终端侧边栏。
- transcript 与侧边栏可独立滚动。
- 粘性顶部区域。
- 感知布局的 overlays。
- 滚动条与未读行指示器。
- Transcript 虚拟化。

## 首次实现的非目标

- CSS 兼容的 flexbox。
- Grid 布局。
- 换行的 flex 行。
- 任意绝对定位；overlays 已覆盖该需求。
- 百分比尺寸，除非能自然从现有尺寸工具中得出。
- 虚拟化 transcript 渲染。
- 增量布局树变更。
- 供自定义组件创建或修改内部布局节点的公开 API。
- 改造每一个现有组件以理解高度约束。
- 给主屏幕模式伪造粘性或嵌套滚动语义。

## 公开 API

### Stack 条目

纵向与横向 stack 使用同一种轴无关的条目类型。

```ts
export interface StackEntryOptions {
	/** Initial size on the stack's main axis. Defaults to "auto". */
	basis?: number | "auto";
	/** Share of positive remaining space. Defaults to 0. */
	grow?: number;
	/** Relative willingness to shrink when content overflows. Defaults to 1. */
	shrink?: number;
	/** Minimum allocated size on the main axis. Defaults to 0. */
	minSize?: number;
	/** Maximum allocated size on the main axis. */
	maxSize?: number;
	/** Conditionally omit this entry for a viewport size. */
	visible?: (viewport: { width: number; height: number }) => boolean;
}

export interface StackEntry extends StackEntryOptions {
	component: Component;
}

export type StackChild = Component | StackEntry;

export interface StackOptions {
	gap?: number;
	align?: "stretch" | "start" | "center" | "end";
}
```

实现中使用显式字段。不要使用 TypeScript 参数属性，因为根配置下的源码必须在 Node strip-only 模式下保持可擦除（erasable）。

### `VStack`

```ts
export class VStack implements Component {
	constructor(children?: StackChild[], options?: StackOptions);

	addChild(component: Component, options?: StackEntryOptions): void;
	removeChild(component: Component): void;
	clear(): void;
	invalidate(): void;
	render(width: number): string[];
}
```

行为：

- 公开的 `render(width)` 提供无界高度渲染，用于兼容与调试。
- 受约束行为由 `TuiAltScreen` 通过内部布局引擎调用。
- 子项自上而下排列。
- `gap` 行仅出现在可见子项之间。
- 交叉轴默认 `stretch`。

### `HStack`

```ts
export class HStack implements Component {
	constructor(children?: StackChild[], options?: StackOptions);

	addChild(component: Component, options?: StackEntryOptions): void;
	removeChild(component: Component): void;
	clear(): void;
	invalidate(): void;
	render(width: number): string[];
}
```

行为：

- 子项自左向右排列。
- 子项宽度由 `basis`、`grow`、`shrink`、`minSize` 与 `maxSize` 分配。
- 较短的子项按 `align` 填充。
- 使用现有的 ANSI 感知切片/合成工具组合 ANSI 行。切勿对终端列使用普通字符串长度或原始 substring。
- 初期图像支持只需保留当前纵向 transcript 行为。横向限制见图像章节。

### `ScrollView`

```ts
export interface ScrollViewOptions {
	axis?: "vertical";
	/** Follow content growth while positioned at the end. */
	follow?: "none" | "end";
	/** Designate this view as the fallback target for global scroll actions. */
	primary?: boolean;
	/** Bubble unused wheel delta to an outer scroll view. */
	overscroll?: "chain" | "contain";
	/** Reserved for a later visible scrollbar implementation. */
	scrollbar?: "hidden" | "auto" | "always";
}

export class ScrollView implements Component {
	constructor(component: Component, options?: ScrollViewOptions);

	get scrollTop(): number;
	get isFollowingEnd(): boolean;

	scrollBy(lines: number): number;
	scrollToStart(): void;
	scrollToEnd(): void;
	invalidate(): void;
	render(width: number): string[];
}
```

`scrollBy()` 返回未使用的 delta，以便嵌套滚动可以连锁：

```ts
const remaining = scrollView.scrollBy(delta);
```

示例：

- 请求 `+3`，移动了 `+3`：返回 `0`。
- 请求 `+3`，只剩一行：移动一行并返回 `+2`。
- 请求 `-3`，已在顶部：返回 `-3`。

行为：

- 在受约束布局中，子项以无界高度测量/渲染，并裁剪到分配的视口。
- 在公开的无界 `render(width)` 中，渲染完整子项。这用于最终文档输出与调试，而非在主屏幕模式中模拟视口行为。
- `follow: "end"` 的行为类似当前的 `TuiAltScreen.stickToBottom`：
  - 以 follow 模式启动
  - 内容增长时保持视图在末尾
  - 滚离末尾会禁用 follow 模式
  - 到达或显式滚到末尾会启用 follow 模式
- 滚动必须请求一次渲染。
- 视口高度变化时保留 `scrollTop`，除非正在跟随末尾。

### 视口能力

不要给每一个 `TUI` 实现都添加受约束布局方法，仿佛主屏幕模式也支持它们。

添加显式能力：

```ts
export interface ViewportTUI extends TUI {
	setLayoutRoot(component: Component | undefined): void;
}

export function isViewportTUI(tui: TUI): tui is ViewportTUI;
```

`TuiAltScreen` 实现 `ViewportTUI`。`TuiMainScreen` 不实现。

类型守卫应检测稳定的能力，而不是依赖应用层的 `instanceof`。具体实现可使用 symbol 或方法存在性检查。

当未设置显式布局根时，`TuiAltScreen` 的行为必须与当前 `addChild()` 用户兼容。将其现有子项视为隐式主 `ScrollView` 中的隐式纵向堆叠文档。

## 内部布局 API

不要从 `packages/tui/src/index.ts` 导出这些类型。

建议模块：`packages/tui/src/layout.ts`。

```ts
interface LayoutConstraints {
	width: number;
	/** Undefined means unbounded height. */
	height: number | undefined;
}

interface LayoutRect {
	x: number;
	y: number;
	width: number;
	height: number;
}

interface LayoutBox {
	component: Component;
	rect: LayoutRect;
	clip: LayoutRect;
	children: LayoutBox[];
	parent?: LayoutBox;
	/** Leaf-rendered lines. Keep the returned array by reference. */
	lines?: readonly string[];
	/** Present when this box represents a ScrollView viewport. */
	scrollView?: ScrollView;
	/** Z/layer ordering for hit testing when needed. */
	layer: number;
}

interface LayoutFrame {
	root: LayoutBox;
	width: number;
	height: number;
	lines: string[];
	primaryScrollView?: ScrollView;
}
```

具体形态可在实现中调整，但必须支持：

- 绘制可见终端行
- 裁剪嵌套子项
- 从终端坐标做命中测试
- 转换到组件本地坐标
- 遍历祖先
- 识别滚动祖先
- 定位光标标记
- 保留足够映射以支持选择与超链接

### 组件树与布局树

公开组件树是长生命周期且有状态的：

```text
VStack
├─ ScrollView
│  └─ chat container
└─ dock VStack
   ├─ editor container
   └─ footer container
```

内部布局树是瞬时帧快照：

```text
box root       rect 0,0,120,40
├─ scroll box  rect 0,0,120,31 clip 0,0,120,31
│  └─ content  rect 0,-85,120,116
└─ dock box    rect 0,31,120,9
```

每次请求的帧都重建布局树。成功绘制后原子替换已提交帧，以便输入始终针对最后显示的几何进行路由。

不要仅为生成布局几何而修改组件状态，除有意的 `ScrollView` 钳制/follow 状态外。

## 渲染与缓存策略

### 重建几何，复用叶子行

一帧新渲染执行：

```ts
const nextLayout = layout(root, terminalBounds);
const nextScreen = paint(nextLayout);
writeScreenDiff(previousScreen, nextScreen);
currentLayout = nextLayout;
```

对叶子组件：

```ts
const lines = component.render(width);
```

在布局 box 中按引用保留 `lines`。多数昂贵叶子已按内容与宽度缓存：

- `Markdown` 缓存文本、宽度与渲染行。
- `Text` 缓存文本、宽度与渲染行。
- `Image` 缓存宽度与渲染行。
- `Box` 基于宽度/背景/子输出缓存。
- 若干 coding-agent 动画与工具组件有各自缓存。

`Editor`、`Input`、选择器、footer 以及一些小叶子会重新计算。初期可以接受。

在 profiling 证明有必要之前，不要在布局引擎中另加 `WeakMap<Component, RenderCache>`。第二套缓存容易因现有组件自有失效语义而过期。

### 在可行处避免不必要的扁平化

首个正确实现可以调用现有的 `Container.render(width)`，它会扁平化子数组。Markdown 解析/高亮仍会被缓存，因此对初始实现可接受。

若简单且安全，可将精确的基类 `Container` 实例优化为结构性纵向 stack，使布局能保留子行数组与高度，而无需扁平化整个 transcript。不要绕过 `Container` 子类（如 message/tool 组件）中覆盖的渲染。将子类视为叶子，除非它们显式选择加入内部结构布局。

不要将此优化作为正确性的前提。

### 无渲染则无布局

仅在 `requestRender()` 调度渲染后重建布局帧。不存在独立的布局循环。

## Stack 布局算法

实现应使用按轴参数化的共享 stack 分配器。

### 可见性

1. 根据终端视口尺寸评估 `visible`。
2. 在计算 gap 或尺寸分配之前移除不可见条目。

### 固有尺寸

- `basis: "auto"` 使用子项在主轴上的固有尺寸。
- 数值 `basis` 使用给定单元格数。
- 将 basis 钳制到 `minSize`/`maxSize`。
- 对换行叶子，必须先分配宽度，才能知道固有高度。
- 因此 `HStack` 在测量子高度之前先分配宽度。
- `VStack` 在分配剩余高度之前，以已分配宽度渲染/测量 auto-height 子项。

### 正剩余空间

将正剩余空间按 `grow` 比例分配给 `grow > 0` 的条目，并尊重 `maxSize`。

使用确定性整数舍入。按子项顺序分配余下单元格，避免布局在帧间抖动。

### 溢出

当总 basis 超过可用尺寸时：

1. 计算可收缩条目（`shrink > 0` 且当前尺寸高于 `minSize`）。
2. 按 `shrink` 与当前 basis（或另一套确定性、已文档化的策略）比例分配所需收缩量。
3. 若某条目在溢出解决前已达 `minSize`，则重复。
4. 若约束仍无法满足，在父边界处裁剪。

聚焦光标不得仅因叶子被裁剪而消失。纵向裁剪叶子且其行含 `CURSOR_MARKER` 时，尽可能选择包含该标记的可见行窗口。

### 初始交互布局尺寸

transcript 应可伸缩，dock 应优先固有高度：

```ts
new VStack([
	{
		component: transcriptScrollView,
		basis: 0,
		grow: 1,
		shrink: 1,
		minSize: 1,
	},
	{
		component: dock,
		basis: "auto",
		grow: 0,
		shrink: 1,
		minSize: 1,
	},
]);
```

实现必须为极小终端与过大自定义 widget 定义合理行为。优先顺序：

1. 在终端高度允许时至少保留一行 transcript。
2. 保留聚焦的 editor/selector 光标。
3. 尽可能至少保留一行 footer。
4. 在隐藏聚焦 editor 之前，先裁剪/截断 widgets 与 pending/status 内容。

这可能需要 coding-agent 特定的 stack 条目 `minSize`/`shrink` 设置，而不是给通用 TUI 布局添加领域特定优先级规则。

## 绘制

### 帧表面

布局引擎可继续使用按终端行的 ANSI 字符串，而不必引入完整单元格对象模型。

绘制必须：

- 在受约束 alt 模式下恰好创建 `terminal.rows` 行基线
- 尊重每个 box 的矩形与累积裁剪
- 使用 ANSI 感知的列切片
- 在独立绘制区域之间重置样式
- 在光标提取前保留 `CURSOR_MARKER`
- 合成横向子项且无样式泄漏
- 产出不超过终端宽度的行

复用：

- `sliceByColumn()`
- `compositeTuiLine()`
- `visibleWidth()`
- 现有的行重置规范化

### 纵向 stacks

在分配的 `y` 处绘制每个子项。跳过不与累积裁剪相交的子项与行范围。

### 横向 stacks

在分配的 `x` 处绘制每个子项。在合成相邻子项前，将短行填充到分配宽度。应用重置边界，使一个子项的样式或 OSC 8 超链接不泄漏到另一个。

### Scroll views

- 子内容按其完整自然高度布局。
- 子项绘制原点按 `-scrollTop` 平移。
- 将 scroll view 的矩形累积到裁剪中。
- 仅绘制与视口相交的子行。
- 在布局树中记录 scroll box，供命中测试与祖先遍历使用。

## 输入与事件路由

### 规范化鼠标事件

终端鼠标解析仍留在 `TuiAltScreen`，但在路由前将解析序列转换为规范化事件：

```ts
interface TuiMouseEvent {
	type: "press" | "release" | "move" | "wheel";
	x: number;
	y: number;
	button: number;
	deltaX: number;
	deltaY: number;
}
```

该类型的公开可见性是可选的。初期滚轮路由器可保持内部。

### 命中测试

对已提交的布局帧做命中测试，而非正在构建的帧。

1. 拒绝位于其 clip 之外的 boxes。
2. 先遍历更高层/最前的子项。
3. 返回包含终端坐标的最深可见 box。
4. 保留祖先链以支持事件冒泡。

### 滚轮路由

对滚轮事件：

1. 在指针处做命中测试。
2. 从最深 box 向根遍历。
3. 将 delta 提供给遇到的每个 `ScrollView`。
4. 若 `overscroll` 为 `"chain"`，将未使用的 delta 传给下一个滚动祖先。
5. 若 `overscroll` 为 `"contain"`，即使仍有剩余 delta 也停止。
6. 若无命中祖先消费该 delta，则提供给帧的主 scroll view。
7. 消费已识别的鼠标序列，使原始鼠标字节永远不会到达 editor。

预期行为：

- 滚轮在 transcript 上：滚动 transcript。
- 滚轮在未来侧边栏上：滚动侧边栏。
- 滚轮在嵌套 scroll view 上：先滚内层，再在边界连锁。
- 滚轮在不可滚动的 dock/footer 上：滚动主 transcript。
- 滚轮交互不得从 editor 抢走键盘焦点。

### 触控板

保留当前行为：对仅纵向的 scroll view 忽略水平滚轮事件。若事件包含双轴，仅消费支持的纵向部分并文档化该策略。

### 禁用鼠标时的回退

不要依赖检测鼠标支持。终端无法提供足够可靠的通用能力信号。

键盘导航始终通过现有可配置动作可用：

- `tui.altScreen.pageUp`
- `tui.altScreen.pageDown`
- `tui.altScreen.top`
- `tui.altScreen.bottom`

将这些动作路由到：

1. 未来多窗格导航设置的显式活动滚动区域（若有）
2. 否则为主 scroll view

首次 coding-agent 布局只有一个 scroll view，因此 transcript 始终是键盘目标。

若未来布局引入多个可选键盘滚动区域，将可配置动作加入 `TUI_KEYBINDINGS`；永远不要硬编码按键检查。

## 焦点与光标行为

- 现有 `TUI.setFocus(component)` 仍是公开键盘焦点 API。
- 键盘焦点与滚轮滚动目标是分离的。滚动侧边栏不得将焦点移离 editor，除非显式请求。
- 绘制期间，在最终合成帧中查找 `CURSOR_MARKER`。
- 光标行列必须包含 stack 偏移、滚动平移、overlay 偏移与横向窗格偏移。
- 仅按现有 `showHardwareCursor` 行为显示硬件光标。
- overlay 焦点恢复所用的布局包含检查必须理解布局根与嵌套布局组件。

## 选择与超链接

当前 alt 渲染器将选择行直接映射到一个全局逻辑文档。一旦存在固定区域与横向区域，该假设不再成立。

首次实现保留可见屏幕选择语义：

- Anchor 与 focus 从终端屏幕坐标开始。
- 针对当前已提交的可见帧应用高亮。
- 使用 ANSI 感知切片与 `stripTerminalSequences()` 从所选可见行/列复制文本。
- 空白/填充区域除必要的行分隔外不贡献文本。
- 继续将选择列对齐到字形边界。

若需要在帧变化间维持选择，在绘制行中存储足够的源映射，将屏幕行转换为叶子行引用。不要将固定 dock 行映射到无关的 transcript 行。

超链接点击可继续从点击列处已提交屏幕行的 OSC 8 元数据读取。确保使用最终合成行，而非未平移的子行。

保持当前行为：

- 无拖拽的点击可调用 `openUrl`
- 拖拽不激活 URL
- 拖拽后释放通过 OSC 52 复制

## 图像

初期必需的图像用例是现有的纵向滚动 transcript。

保留：

- Kitty 图像元数据与预留行
- 当 Kitty 图像顶部高于滚动视口时的裁剪
- 含图像的行变化时的删除/重绘
- alt 模式下 iTerm2 回退为文本

图像协议行的横向合成在首次实现中不必完全通用。终端图像放置不像普通 ANSI 文本。文档化并防御性处理该限制：

- `HStack` 中含图像的组件可能需要占据整行/全宽
- 不要静默破坏相邻窗格输出
- 为所选回退策略添加针对性测试

不要回退现有纵向图像测试。

## Overlays

保留当前 overlay 栈与定位 API。

初期集成：

1. 将受约束基布局绘制为终端高度行。
2. 使用现有 overlay 逻辑将这些行上合成 overlays。
3. 从最终结果提取光标。
4. 应用差分渲染。

现有 overlays 在首次实现中不必成为嵌套 `ScrollView` 布局根。但基布局命中测试不得破坏 overlay 焦点或输入所有权。

后续阶段可给每个 overlay 自己的受约束布局树，并将 overlay boxes 作为更高的命中测试层。

## `TuiAltScreen` 重构

变更后的建议状态：

```ts
private layoutRoot?: Component;
private currentLayout?: LayoutFrame;
private implicitScrollView?: ScrollView;
```

在适用处将这些责任从 `TuiAltScreen` 全局字段移入 `ScrollView`：

- `scrollTop`
- `contentLineCount`
- `stickToBottom`

兼容性 getter/方法如 `viewportTop`、`isFollowingOutput`、`scrollBy()`、`scrollToTop()` 与 `scrollToBottom()` 可委托给主/隐式 scroll view，使现有测试与消费者继续工作。若保留向后兼容会实质复杂化实现，则不必保留，除非测试/公开 API 表明这些方法被依赖；移除前检查导出与用法。

`doRender()` 在概念上变为：

```ts
const root = this.layoutRoot ?? this.getImplicitLegacyRoot();
const nextLayout = layoutConstrained(root, width, height);
let screen = paint(nextLayout);
screen = this.compositeOverlays(screen, width, height);
screen = this.applySelection(screen);
const cursor = this.extractCursorPosition(screen, height);
// Normalize, crop defensive overflow, diff, write.
this.currentLayout = nextLayout;
```

### 遗留隐式根

当调用方仅使用 `tui.addChild()` 时：

```text
implicit ScrollView(primary, follow=end)
└─ implicit vertical document of TuiAltScreen.children
```

这保留当前独立的 `TuiAltScreen` API 与测试。

隐式根必须观察后续的 `addChild()`、`removeChild()` 与 `clear()` 变更。

### 停止时的最终文档

离开 alt 模式时，以无界高度渲染显式或隐式根：

- `ScrollView` 发出完整子项，而非裁剪视口。
- coding-agent transcript 先出现，dock 在其后出现一次。
- 不要打印终端高度的填充行。
- 剥离光标标记。
- 保留现有行重置与图像清理。

不要仅用最后可见帧作为退出文档。

## 交互模式改动

文件：`packages/coding-agent/src/modes/interactive/interactive-mode.ts`

改动应保持小。

### 添加稳定分组容器

```ts
private documentContainer: Container;
private footerContainer: Container;
```

现有组件容器保持不变：

- `headerContainer`
- `loadedResourcesContainer`
- `chatContainer`
- `pendingMessagesContainer`
- `statusContainer`
- `widgetContainerAbove`
- `editorContainer`
- `widgetContainerBelow`

构建 transcript 组一次：

```ts
this.documentContainer.addChild(this.headerContainer);
this.documentContainer.addChild(this.loadedResourcesContainer);
this.documentContainer.addChild(this.chatContainer);
```

构建 footer 槽一次：

```ts
this.footerContainer.addChild(this.footer);
```

### 主屏幕组合

保留精确当前顺序：

```ts
this.ui.addChild(this.documentContainer);
this.ui.addChild(this.pendingMessagesContainer);
this.ui.addChild(this.statusContainer);
this.ui.addChild(this.widgetContainerAbove);
this.ui.addChild(this.editorContainer);
this.ui.addChild(this.widgetContainerBelow);
this.ui.addChild(this.footerContainer);
```

因为 `documentContainer` 在视觉上透明，其三个子项渲染位置与今日完全相同。

### 备用屏幕组合

```ts
const transcript = new ScrollView(this.documentContainer, {
	follow: "end",
	primary: true,
	overscroll: "chain",
});

const dock = new VStack([
	{ component: this.pendingMessagesContainer, shrink: 1, minSize: 0 },
	{ component: this.statusContainer, shrink: 1, minSize: 0 },
	{ component: this.widgetContainerAbove, shrink: 1, minSize: 0 },
	{ component: this.editorContainer, shrink: 1, minSize: 3 },
	{ component: this.widgetContainerBelow, shrink: 1, minSize: 0 },
	{ component: this.footerContainer, shrink: 1, minSize: 1 },
]);

const root = new VStack([
	{ component: transcript, basis: 0, grow: 1, shrink: 1, minSize: 1 },
	{ component: dock, basis: "auto", grow: 0, shrink: 1, minSize: 1 },
]);

viewportTui.setLayoutRoot(root);
```

用 `isViewportTUI(this.ui)` 做收窄。由于 `options.alt` 已选择渲染器，无法获得该能力属于内部编程错误，而非静默回退。

### 自定义 footer 替换

重构 `setExtensionFooter()`，使其永不移除/添加根 TUI 子项：

```ts
this.footerContainer.clear();
this.footerContainer.addChild(this.customFooter ?? this.footer);
this.ui.requestRender();
```

继续 dispose 被替换的自定义 footers。

### 应无需逻辑改动的功能

- message 渲染
- streaming 更新
- tool 更新
- widget APIs
- editor 替换
- extension selectors/input/editor
- 内置 selectors
- queue 渲染
- status indicators
- 焦点变化
- overlays
- theme invalidation

这些功能修改现有稳定容器，应自动出现在正确布局中。

### 现有的 alt 专用 status 变通

重新审视此代码：

```ts
if (hadActiveStatusIndicator && !this.options.alt && this.ui.getClearOnShrink()) {
	this.statusContainer.addChild(this.idleStatus);
}
```

主屏幕变通应仍仅限主屏幕。受约束 alt 布局应自然清除已释放行。

## 建议文件

可能的新文件：

- `packages/tui/src/layout.ts` — 内部约束、boxes、布局、绘制、命中测试
- `packages/tui/src/components/v-stack.ts`
- `packages/tui/src/components/h-stack.ts`
- `packages/tui/src/components/scroll-view.ts`

可能修改的文件：

- `packages/tui/src/tui.ts`
- `packages/tui/src/tui-alt-screen.ts`
- `packages/tui/src/index.ts`
- `packages/tui/src/keybindings.ts` 仅当需要新的可配置动作时
- `packages/coding-agent/src/modes/interactive/interactive-mode.ts`
- `packages/tui/test/tui-alt-screen.test.ts`
- `packages/tui/test/` 下新的针对性布局测试
- `packages/coding-agent/test/interactive-tui.test.ts`
- `packages/tui/README.md`
- `packages/coding-agent/docs/usage.md`
- 若键盘行为变化：`packages/coding-agent/docs/keybindings.md`
- `packages/tui/CHANGELOG.md`
- `packages/coding-agent/CHANGELOG.md`

不要修改已发布的 changelog 章节。在现有 `## [Unreleased]` 子节下添加入口。

## 测试计划

### Stack 分配测试

为两轴添加针对性单元测试：

- auto 尺寸子项
- 数值 basis
- 正 grow 分配
- shrink 分配
- min/max 钳制
- 确定性奇数单元格舍入
- gap 仅在可见子项之间
- 条件可见性
- 交叉轴对齐
- 子输出宽于分配时安全裁剪
- ANSI 样式/超链接不在横向子项间泄漏
- 横向裁剪中的 CJK、emoji 与组合字符边界

### ScrollView 测试

- 初始 `follow: "end"` 位置
- 跟随时的内容增长
- 手动向上滚动禁用 follow
- 到达底部重新启用 follow
- 显式 `scrollToEnd()` 重新启用 follow
- 跟随时的视口增长/收缩
- 手动定位时的视口增长/收缩
- `scrollBy()` 返回未使用的正/负 delta
- 嵌套滚动连锁
- `overscroll: "contain"`
- 子项短于视口
- 空子项
- 子宽度变化
- 聚焦内容被裁剪时光标标记仍可见

### 布局帧测试

- 嵌套 V/H stack 生成的矩形
- 累积裁剪
- 命中测试返回最深可见 box
- 被裁剪的 boxes 不可命中
- 本地坐标转换
- 层序
- scroll view 仅绘制可见行
- 每次 resize/内容变化后帧使用新几何
- 缓存的叶子行数组按引用接受且不被修改

### 备用屏幕渲染器测试

扩展 `packages/tui/test/tui-alt-screen.test.ts`：

- 遗留 `addChild()` 路径仍表现为当前隐式滚动
- 显式布局根渲染终端高度帧
- transcript 滚动时固定 dock 不变
- transcript 视口高度计入 dock 高度
- 跟随时的 dock 增长/收缩
- 手动滚动时的 dock 增长/收缩
- Shift+PageUp/Down 针对主 ScrollView
- Ctrl+Home/End 针对主 ScrollView
- transcript 上的滚轮滚动 transcript
- 不可滚动 dock 上的滚轮回退到主 transcript
- 嵌套滚动先消费再冒泡未用 delta
- 禁用鼠标模式仍支持键盘滚动
- dock 内光标行正确
- 已滚动内容内光标行正确
- overlay 合成仍相对屏幕
- overlay 焦点行为仍正确
- 经横向/纵向偏移后 OSC 8 点击仍正确
- transcript 中选择/复制可用
- dock 中选择/复制可用且不映射到 transcript 行
- 终端 resize 重新计算布局
- 过大 dock 不丢失聚焦光标
- 停止时恰好打印完整 transcript 加 dock 一次
- 最终输出无终端填充行

保留并通过所有现有图像测试：

- 视口顶部的 Kitty 裁剪
- 图像删除/重绘
- iTerm2 回退
- 无陈旧图像放置

### 主屏幕回归测试

- 现有主屏幕测试不变地通过
- 交互主屏幕子项顺序/渲染输出不变
- 自定义 footer 在流式布局中仍在底部
- 主屏幕模式不安装布局根或应用层滚动

### Coding-agent 集成测试

在 `packages/coding-agent/test/interactive-tui.test.ts` 或针对性新测试中：

- 渲染器能力仅对 alt 模式暴露
- 主模式挂载流式组合
- alt 模式挂载 transcript ScrollView 加 dock
- pending/status/widgets/editor/footer 在 dock 中
- 自定义 footer 替换更新 `footerContainer`
- editor 替换不重建根布局
- widget 更新不重建公开组件组合

优先检查组件组合或使用 `VirtualTerminal`；不要使用真实 provider API。

## 验证命令

实现改动后：

1. 从相关 package 根目录，按仓库规定的 Vitest 调用方式运行每个已修改/新增的针对性测试。
2. 从仓库根运行 `npm run check`，并修复所有 errors、warnings 与 infos。
3. 不要运行 `npm test` 或完整 Vitest 套件。
4. 若需要更广验证，可选使用仓库的 `./test.sh` 运行全部非 e2e 测试。
5. 按 `AGENTS.md` 中的流程在 tmux 中手动演练 alt 模式：
   - 长 transcript
   - 滚轮/触控板滚动
   - Shift+PageUp/Down
   - 手动滚动时的 streaming
   - 回到底部/follow
   - 多行 editor
   - autocomplete 打开
   - settings/model/tree selectors 替换 editor
   - editor 上下的 extension widget
   - 自定义 footer
   - 终端 resize
   - 超链接点击
   - 鼠标选择/复制
   - 可用时的 Kitty 图像
6. 手动冒烟测试主屏幕模式，确保终端 scrollback 行为不变。

## 建议实现顺序

1. 添加 stack 分配单元测试与共享轴分配器。
2. 实现 `VStack` 无界渲染与受约束内部布局。
3. 实现带 ANSI 安全合成的 `HStack`。
4. 实现独立于终端 ANSI 输出的 `ScrollView` 状态与单元测试。
5. 实现内部布局帧生成与绘制。
6. 添加命中测试与滚动祖先遍历。
7. 将显式与隐式布局根集成到 `TuiAltScreen`。
8. 将当前全局 alt 滚动行为移到隐式主 `ScrollView` 兼容路径之后。
9. 逐个子系统保留选择、超链接、光标、overlays 与图像处理，每步后运行现有测试。
10. 添加 coding-agent 分组容器与两个小的组合分支。
11. 重构自定义 footer 替换以使用 `footerContainer`。
12. 添加集成测试、文档与 changelog 条目。
13. 运行针对性测试与 `npm run check`。
14. 在两种模式下执行 tmux/手动冒烟测试。

## 验收标准

实现在以下条件满足时完成：

- 主屏幕模式行为与以前一致，并保留终端 scrollback。
- Alt 屏幕模式具有可滚动 transcript 与固定底部 dock。
- Streaming 仅在 follow 模式激活时跟随 transcript 末尾。
- 新输出到达时手动滚动保持稳定。
- 鼠标滚轮路由到合适的 scroll view，并在边界连锁。
- 禁用鼠标时键盘导航可用。
- Editor/selector 焦点与 IME 光标放置保持正确。
- Widgets 与自定义 footers 保持扩展兼容，并在 alt 模式中固定。
- 超链接、选择、overlays 与 Kitty transcript 图像不回退。
- 离开 alt 模式时完整逻辑文档打印一次。
- Layout boxes 为内部实现，并按请求的帧重建。
- 昂贵叶子渲染继续使用现有组件缓存。
- 所有针对性测试与 `npm run check` 通过。
