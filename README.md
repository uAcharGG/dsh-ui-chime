# dsh-ui-chime（思考结束提示音）

音效提示插件，对话结束播放一声短促的"叮"。

## 什么时候响

- **每轮对话全部完成**（`turn/end`，completed / max-tokens）——多步骤回合中间的间歇思考不响；
- **等待用户确认权限**（`approval/asked`）；
- **等待用户选择方案**（模型调用 `ask_user_question` 工具）。

历史回放（打开会话、翻页、重连）不会响：以事件时间距现在是否在 10 秒内作为实时门控。

## 怎么用

- **音量调节**：聊天输入框工具行（左侧）有一个喇叭按钮，点击弹出音量滑条，设置会记住（localStorage）。
- 浏览器自动播放策略：首次与页面交互前 `AudioContext` 保持挂起，声音静默；点击页面任意位置后即正常。

## 安装 / 卸载（dsh-launcher）

- 安装：管理面板 → 插件 → 安装，来源选"本地路径"，填入 `D:\Pro\dsh-ui-chime`（等价于 `pnpm dsh plugin --profile web add link:D:\Pro\dsh-ui-chime`），完成后**重启 dsh** 生效。
- 卸载：面板插件列表 → 卸载（等价于 `pnpm dsh plugin --profile web remove @uachar/dsh-ui-chime`），重启后移除。
- 启停：面板插件列表 → 启/停用（只改组合层，不卸载代码）。

## 结构

| 文件 | 作用 |
|---|---|
| `cordis.patch.yml` | bundle 组合层：把自己作为一行 `ui-chime` 插入 profile |
| `src/index.ts` | node half：空 apply（让行出现在 Host Loader / `dsh.client` 扫描） |
| `src/client/index.ts` | browser half：注册头less Conversation Definition（响铃触发）+ 音量控件 |
| `src/client/chime.ts` | Web Audio 合成引擎 + 音量持久化 |
| `src/client/volume-control.tsx` | 输入框工具行的音量滑块 |

构建：`pnpm install && pnpm run build`（tsc → tsdown，产出 `lib/index.js` 与 `lib/client.js`）。
