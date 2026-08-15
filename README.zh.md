# dsh-ui-chime（思考结束提示音）

DeepSeek Harness 的浏览器提示音插件：每当模型到达用户关心的边界——一轮对话完成，或正在等待用户——浏览器播放一声短促的合成"叮"。无音频资源、不写会话日志、不改 dsh 核心；作为独立包经 dsh-launcher 安装与管理。

## 什么时候响

- **每轮对话全部完成**（`turn/end`，`completed` / `max-tokens`）——多步骤回合中间的间歇思考不响。
- **等待用户确认权限**（`approval/asked`）——模型在等权限决定。
- **模型调用 `ask_user_question`**（`tool/call`）——它在等用户选择方案。

历史回放（打开会话、翻页、重连）不会响：事件距现在 10 秒内才视为实时。

## 怎么用

- **音量调节**：聊天输入框工具行左侧的喇叭按钮（Windows 风格线条图标），点击弹出音量滑条；设置保存在 `localStorage`。**拖动滑条时会即时播放对应音量的试听音**，方便判断合适的音量。
- **自动播放策略**：浏览器在首次用户手势前挂起 `AudioContext`，因此页面未被点击过时提示音静默——点击页面任意位置后即正常。

## 安装 / 卸载

通过 dsh-launcher（本地路径 → `D:\Pro\dsh-ui-chime`）安装，或手动执行：

```sh
pnpm dsh plugin --profile web add link:D:\Pro\dsh-ui-chime
```

之后**重启 dsh** 生效。卸载：面板中卸载（或 `pnpm dsh plugin --profile web remove @uachar/dsh-ui-chime`）后重启。启停只改组合层，不卸载代码。

## 结构

| 文件 | 作用 |
|---|---|
| `cordis.patch.yml` | bundle 组合层：把自己作为一行 `ui-chime` 插入 profile |
| `src/index.ts` | node half：空 apply（让行出现在 Host Loader / `dsh.client` 扫描） |
| `src/client/index.ts` | browser half：头less Conversation Definition（响铃触发）+ 音量控件注册 |
| `src/client/chime.ts` | Web Audio 合成引擎 + 音量持久化 |
| `src/client/volume-control.tsx` | 输入框工具行的喇叭按钮与音量滑条 |

## 构建

```sh
pnpm install
pnpm run build        # tsc -> tsdown；产出 lib/index.js 与 lib/client.js
```

## 已知限制

- **自动播放策略** — 首次用户手势之前的提示音会被静默跳过（解锁监听器让之后的一声正常响起）。
- **仅边界事件** — 触发点是 `turn/end`、`approval/asked` 与 `ask_user_question` 工具调用；推理中途被中断的步骤不会响。
- **无按会话控制** — 提示音对所有会话同一音量（全局音量，存 localStorage）。

## 许可

MIT
