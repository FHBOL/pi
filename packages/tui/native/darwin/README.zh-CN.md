# Darwin 原生预构建

从仓库根目录构建两种 macOS 架构：

```sh
npm --prefix packages/tui run build:native:darwin
```

构建使用 macOS 11.0 作为 arm64 部署目标，使用 macOS 10.15 作为 x86_64 部署目标。在 macOS 上，`build.sh` 通过 `xcrun` 查找 Apple clang 与当前活动的 macOS SDK。Intel 或 Apple Silicon 主机均可构建两种输出。

非 macOS 主机需要完整的 Darwin 交叉工具链，包括 macOS SDK 与 Mach-O 链接器。例如，可用 `CC` 与 `SDKROOT` 选择 osxcross 安装：

```sh
CC=/path/to/osxcross/clang SDKROOT=/path/to/MacOSX.sdk \
  npm --prefix packages/tui run build:native:darwin
```

SDK 的获取与使用必须符合 Apple 许可。普通的 Linux 或 Windows clang 不够，因为该 addon 包含并链接 CoreGraphics。

此处不使用 Zig，因为它不提供 Apple SDK 或 CoreGraphics 框架桩。因此它不能使该构建独立于 SDK，且其 clang 驱动目前也无法作为 Apple clang 的即插即用替代来处理此 Mach-O bundle 配方。
