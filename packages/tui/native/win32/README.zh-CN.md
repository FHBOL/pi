# Windows 原生预构建

从仓库根目录构建两种 Windows 架构：

```sh
npm --prefix packages/tui run build:native:win32
```

在 Windows 上，构建使用 Visual Studio 的 Microsoft C++ Build Tools。`build.mjs` 定位 `VsDevCmd.bat`，为 `amd64` 与 `arm64` 初始化开发者环境，并用 `cl.exe`/`link.exe` 构建 addon。

安装 “Desktop development with C++” 工作负载，或至少安装 MSVC 工具集与 Windows SDK 组件。不需要 Node 头文件；addon 从宿主进程解析 N-API 符号。

对于非 Windows 交叉构建，或自定义 Windows 工具链，设置 `PI_TUI_WIN32_TOOLCHAIN=mingw` 并提供 MinGW 兼容的编译器：

```sh
PI_TUI_WIN32_TOOLCHAIN=mingw \
CC_X64=/path/to/x86_64-w64-mingw32-gcc \
CC_ARM64=/path/to/aarch64-w64-mingw32-gcc \
npm --prefix packages/tui run build:native:win32
```

该 addon 有意避免 C 运行时，且仅链接 `kernel32`。
