> pi 可以帮助你创建 pi 包。请它把扩展、skills、提示模板或主题打包起来。

# Pi 包（Packages）

Pi 包将扩展、skills、提示模板和主题打包，以便通过 npm 或 git 分享。包可以在 `package.json` 的 `pi` 键下声明资源，或使用约定目录。

## 目录

- [安装与管理](#安装与管理)
- [包来源](#包来源)
- [创建 Pi 包](#创建-pi-包)
- [包结构](#包结构)
- [依赖](#依赖)
- [包过滤](#包过滤)
- [启用与禁用资源](#启用与禁用资源)
- [作用域与去重](#作用域与去重)

## 安装与管理

> **安全：** Pi 包拥有完整系统访问权限。扩展可执行任意代码，skills 可指示模型执行任何操作（包括运行可执行文件）。安装第三方包前请审查源代码。

```bash
pi install npm:@foo/bar@1.0.0
pi install git:github.com/user/repo@v1
pi install https://github.com/user/repo  # raw URLs work too
pi install /absolute/path/to/package
pi install ./relative/path/to/package

pi remove npm:@foo/bar
pi list                     # show installed packages from settings
pi update                   # update pi only
pi update --all             # update pi, update packages, and reconcile pinned git refs
pi update --extensions      # update packages and reconcile pinned git refs only
pi update --models          # refresh model catalogs only
pi update --self            # update pi only
pi update --self --force    # reinstall pi even if current
pi update npm:@foo/bar      # update one package
pi update --extension npm:@foo/bar
```

这些命令管理 pi 包，且 `pi update` 可以更新 pi CLI 安装。要卸载 pi 本身，参见 [快速开始](quickstart.md#uninstall)。

默认情况下，`install` 和 `remove` 写入用户设置（`~/.pi/agent/settings.json`）。使用 `-l` 改为写入项目设置（`.pi/settings.json`）。项目设置可与团队共享，项目受信任后 pi 会在启动时自动安装缺失的包。

若要试用包而不安装，使用 `--extension` 或 `-e`。这会安装到临时目录，仅用于当前运行：

```bash
pi -e npm:@foo/bar
pi -e git:github.com/user/repo
```

## 包来源

Pi 在设置与 `pi install` 中接受三种来源类型。

### npm

```
npm:@scope/pkg@1.2.3
npm:pkg
```

- 带版本的规格会被固定，包更新时跳过（`pi update --extensions`、`pi update --all`）。
- 用户安装位于 `~/.pi/agent/npm/`。
- 项目安装位于 `.pi/npm/`。
- 在 `settings.json` 中设置 `npmCommand`，可将 npm 包查找与安装操作固定到特定包装命令，例如 `mise` 或 `asdf`。

示例：

```json
{
  "npmCommand": ["mise", "exec", "node@20", "--", "npm"]
}
```

### git

```
git:github.com/user/repo@v1
git:git@github.com:user/repo@v1
https://github.com/user/repo@v1
ssh://git@github.com/user/repo@v1
```

- 无 `git:` 前缀时，仅接受协议 URL（`https://`、`http://`、`ssh://`、`git://`）。
- 有 `git:` 前缀时，接受简写格式，包括 `github.com/user/repo` 和 `git@github.com:user/repo`。
- HTTPS 与 SSH URL 均支持。
- SSH URL 自动使用你配置的 SSH 密钥（遵循 `~/.ssh/config`）。
- 对于非交互运行（例如 CI），可设置 `GIT_TERMINAL_PROMPT=0` 禁用凭据提示，并设置 `GIT_SSH_COMMAND`（例如 `ssh -o BatchMode=yes -o ConnectTimeout=5`）以快速失败。
- Ref 固定为标签或提交。`pi update --extensions` 与 `pi update --all` 不会将它们移到更新的 ref，但会将现有克隆对齐到配置的 ref。
- 使用 `pi install git:host/user/repo@new-ref` 可更新设置并将现有包移到新的固定 ref。
- 克隆到 `~/.pi/agent/git/<host>/<path>`（全局）或 `.pi/git/<host>/<path>`（项目）。
- 当对齐改变检出时，pi 会 reset 并 clean 克隆，若存在 `package.json` 则运行 `npm install`。

**SSH 示例：**
```bash
# git@host:path shorthand (requires git: prefix)
pi install git:git@github.com:user/repo

# ssh:// protocol format
pi install ssh://git@github.com/user/repo

# With version ref
pi install git:git@github.com:user/repo@v1.0.0
```

### 本地路径

```
/absolute/path/to/package
./relative/path/to/package
```

本地路径指向磁盘上的文件或目录，并加入设置而不复制。相对路径相对于它们所在的设置文件解析。若路径是文件，则作为单个扩展加载。若是目录，pi 按包规则加载资源。

## 创建 Pi 包

在 `package.json` 中添加 `pi` 清单，或使用约定目录。加入 `pi-package` 关键字以便发现。

```json
{
  "name": "my-package",
  "keywords": ["pi-package"],
  "pi": {
    "extensions": ["./extensions"],
    "skills": ["./skills"],
    "prompts": ["./prompts"],
    "themes": ["./themes"]
  }
}
```

路径相对于包根。数组支持 glob 模式与 `!exclusions`。

### 图库元数据

[包图库](https://pi.dev/packages) 显示带 `pi-package` 标签的包。添加 `video` 或 `image` 字段以显示预览：

```json
{
  "name": "my-package",
  "keywords": ["pi-package"],
  "pi": {
    "extensions": ["./extensions"],
    "video": "https://example.com/demo.mp4",
    "image": "https://example.com/screenshot.png"
  }
}
```

- **video**：仅 MP4。在桌面上悬停时自动播放。点击打开全屏播放器。
- **image**：PNG、JPEG、GIF 或 WebP。显示为静态预览。

若两者都设置，优先使用 video。

## 包结构

### 约定目录

若无 `pi` 清单，pi 会从这些目录自动发现资源：

- `extensions/` 加载 `.ts` 与 `.js` 文件
- `skills/` 递归查找 `SKILL.md` 文件夹，并将顶层 `.md` 文件作为 skills 加载
- `prompts/` 加载 `.md` 文件
- `themes/` 加载 `.json` 文件

## 依赖

第三方运行时依赖应放在 `package.json` 的 `dependencies` 中。不注册扩展、skills、提示模板或主题的依赖也应放在 `dependencies` 中。当 pi 从 npm 或 git 安装包时会运行 `npm install`，因此这些依赖会自动安装。

Pi 为扩展与 skills 捆绑了核心包。若你导入其中任何一个，请在 `peerDependencies` 中以 `"*"` 范围列出它们，且不要捆绑它们：`@earendil-works/pi-ai`、`@earendil-works/pi-agent-core`、`@earendil-works/pi-coding-agent`、`@earendil-works/pi-tui`、`typebox`。

其他 pi 包必须捆绑在你的 tarball 中。将它们加入 `dependencies` 与 `bundledDependencies`，然后通过 `node_modules/` 路径引用其资源。Pi 以独立的模块根加载包，因此分开安装不会冲突或共享模块。

示例：

```json
{
  "dependencies": {
    "shitty-extensions": "^1.0.1"
  },
  "bundledDependencies": ["shitty-extensions"],
  "pi": {
    "extensions": ["extensions", "node_modules/shitty-extensions/extensions"],
    "skills": ["skills", "node_modules/shitty-extensions/skills"]
  }
}
```

## 包过滤

在设置中使用对象形式过滤包加载的内容：

```json
{
  "packages": [
    "npm:simple-pkg",
    {
      "source": "npm:my-package",
      "extensions": ["extensions/*.ts", "!extensions/legacy.ts"],
      "skills": [],
      "prompts": ["prompts/review.md"],
      "themes": ["+themes/legacy.json"]
    }
  ]
}
```

`+path` 与 `-path` 是相对于包根的精确路径。

- 省略某个键以加载该类型的全部。
- 使用 `[]` 以不加载该类型的任何内容。
- `!pattern` 排除匹配项。
- `+path` 强制包含精确路径。
- `-path` 强制排除精确路径。
- 过滤器叠在清单之上。它们收窄已允许的内容。

## 启用与禁用资源

使用 `pi config` 启用或禁用来自已安装包与本地目录的扩展、skills、提示模板和主题。`pi config` 从全局设置（`~/.pi/agent/settings.json`）开始；按 Tab 在全局与项目本地模式之间切换。使用 `pi config -l` 从项目覆盖（`.pi/settings.json`）开始，继承的全局资源会变暗显示。

## 作用域与去重

包可以同时出现在全局与项目设置中。若同一包出现在两者中，项目条目胜出，除非项目条目有 `autoload: false`，此时它作为对全局条目的增量应用。身份由以下决定：

- npm：包名
- git：不含 ref 的仓库 URL
- 本地：解析后的绝对路径
