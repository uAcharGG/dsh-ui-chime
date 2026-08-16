# @uachar/dsh-ui-chime（思考结束提示音）

DeepSeek Harness 的浏览器提示音插件：每当模型到达用户关心的边界——一轮对话完成，或正在等待用户——浏览器播放一声短促的合成"叮"。无音频资源、不写会话日志、不改 dsh 核心；作为独立包安装。

## 插件功能

- **每轮对话全部完成**时响（`turn/end`，`completed` / `max-tokens`）——多步骤回合中间的间歇思考不响。
- **等待用户确认权限**时响（`approval/asked`）——模型在等权限决定。
- **模型调用 `ask_user_question`** 时响（`tool/call`）——它在等用户选择方案。
- **音量调节**，拖动滑条即时试听，设置持久保存。
- 音效由 Web Audio 合成（振荡器 + 增益包络）——**零音频文件**，不增加任何资源体积。
- 历史回放（打开会话、翻页、重连）不响：事件距现在 10 秒内才视为实时。

## 如何使用

- **音量调节**：聊天输入框工具行左侧的喇叭按钮（Windows 风格线条图标），点击弹出音量滑条；**拖动滑条时会即时播放对应音量的试听音**。设置保存在 `localStorage`（`dsh.ui-chime.volume`）。
- **自动播放策略**：浏览器在首次用户手势前挂起 `AudioContext`，因此页面未被点击过时提示音静默——点击页面任意位置后即正常。

## 安装与卸载

> 需要可用的 `dsh` CLI（pnpm）与一个 profile，例如 `web`。

### 从 npm 安装（推荐）

```sh
pnpm dsh plugin --profile web add @uachar/dsh-ui-chime
```

### 从 GitHub Release tarball 安装

```sh
pnpm dsh plugin --profile web add https://github.com/uAcharGG/dsh-ui-chime/releases/download/v0.1.0/uachar-dsh-ui-chime-0.1.0.tgz
```

### 从源码构建并安装

```sh
git clone https://github.com/uAcharGG/dsh-ui-chime.git
cd dsh-ui-chime
pnpm install
pnpm run build        # tsc -> tsdown；产出 lib/index.js 与 lib/client.js
pnpm dsh plugin --profile web add link:<本目录的绝对路径>
```

安装后**重启 dsh** 生效。

### 卸载

```sh
pnpm dsh plugin --profile web remove @uachar/dsh-ui-chime
```

随后重启 dsh。（面板中的启/停只改组合层，不卸载代码。）

## 项目文件结构

| 文件 | 作用 |
|---|---|
| `cordis.patch.yml` | bundle 组合层：把自己作为一行 `ui-chime` 插入 profile |
| `src/index.ts` | 主机侧：空 apply（让行出现在 Host Loader / `dsh.client` 扫描中） |
| `src/client/index.ts` | 浏览器侧：无头 Conversation Definition（响铃触发）+ 音量控件注册 |
| `src/client/chime.ts` | Web Audio 合成引擎 + 音量持久化 |
| `src/client/volume-control.tsx` | 输入框工具行的喇叭按钮与音量滑条 |
| `lib/` | 构建产物（随包发布） |

## 使用限制

- **自动播放策略** —— 首次用户手势之前的提示音会被静默跳过（解锁监听器让之后的一声正常响起）。
- **仅边界事件** —— 触发点是 `turn/end`、`approval/asked` 与 `ask_user_question` 工具调用；推理中途被中断的步骤不会响。
- **无按会话控制** —— 提示音对所有会话同一音量（全局音量，存 localStorage）。

## 许可

MIT
