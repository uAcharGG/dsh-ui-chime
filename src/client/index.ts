/**
 * Thinking-end chime plugin, browser half. Rings exactly when the model's
 * work reaches a boundary the user cares about:
 *
 *  1. a turn completes (`turn/end` with a completed/max-tokens reason) — the
 *     whole round of conversation is done, not the intermediate thinking
 *     phases of multi-step turns;
 *  2. an approval is asked (`approval/asked`) — the model is waiting on a
 *     permission decision;
 *  3. the model invokes `ask_user_question` (`tool/call`) — the model is
 *     waiting for the user to pick an option.
 *
 * Everything rides the session event stream through one headless
 * Conversation Definition, so no Host change and no forwarded event is
 * needed: the plugin is a standalone bundle installed through dsh-launcher.
 * A liveness gate (`Date.now() - event.time`) keeps history replay — session
 * open, pagination, reconnect — silent.
 *
 * The browser half also registers a small volume control into the composer
 * tool row (`conversation.input.left`), persisting the setting in
 * localStorage.
 */

import type { ClientContext, ConversationNodeDefinition } from '@deepseek-ai/dsh-client-runtime/client'
import type { SessionEvent } from '@deepseek-ai/dsh-session/types'
// Type-only: pulls the Host event declarations this definition matches —
// user-approval's `approval/asked` SessionEventMap extension (and the
// conversation package's SlotMap/InputZone declarations).
import type {} from '@deepseek-ai/dsh-user-approval'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-client-ui-slots'
import { ThinkingChime } from './chime.ts'
import { VolumeControl } from './volume-control.tsx'

/** Tool name whose invocation means "the model waits for the user to choose". */
const ASK_TOOL_NAME = 'ask_user_question'
/** How recent (ms) an event must be to count as live rather than replayed history. */
const LIVE_GRACE_MS = 10_000

/**
 * Whether one session event marks a boundary worth ringing about.
 * @param event - the appended session event.
 * @returns true for a completed turn, an approval ask, or an ask_user_question call.
 */
export function isRingEvent(event: SessionEvent): boolean {
  if (event.type === 'turn/end') {
    return event.data.reason.kind === 'completed' || event.data.reason.kind === 'max-tokens'
  }
  if (event.type === 'approval/asked') return true
  if (event.type === 'tool/call') return event.data.name === ASK_TOOL_NAME
  return false
}

/**
 * Build the headless Conversation Definition that rings the chime on live
 * boundary events. One context per triggering event (`ring-<seq>`), so every
 * boundary rings exactly once; replayed history is silenced by the time gate.
 *
 * 主代理 turn/end 只有在"主代理任务完全结束"时才响：子代理（subagent）还在
 * 后台运行时，其完成会驱动主代理连续开新 turn 处理结果，这些 turn 的结束
 * 不算任务完成（`hasRunningSubagent()` 为 true 时不响）；等全部子代理
 * 结束、主代理汇总完成的那次 turn/end 才会响。
 * @param chime - the chime player.
 * @param hasRunningSubagent - whether the current session still has running
 *   background subagents (checked only for turn/end; approval/ask events keep
 *   ringing because they mean the model waits on the user).
 * @returns the definition to register.
 */
export function createRingDefinition(chime: ThinkingChime, hasRunningSubagent: () => boolean): ConversationNodeDefinition<Record<string, never>> {
  return {
    kind: 'ui-chime-ring',
    match: (event) => isRingEvent(event) ? { id: `ring-${event.seq}`, role: 'start' } : null,
    start: (_context, match) => {
      const event = match.event
      if (event.type === 'turn/end' && hasRunningSubagent()) return {}
      if (Date.now() - event.time <= LIVE_GRACE_MS) chime.play()
      return {}
    },
    update: (context) => context.state,
    publication: () => 'none',
  }
}

/** Required services: the conversation Definition registry, slots, and sessions. */
export const inject = ['conversationEvents', 'slots', 'sessions']

/**
 * Browser plugin body: register the ring Definition and the volume control.
 *
 * 提问/审批触发（rc.7 起）：ask_user_question 与 approval 不再走会话事件
 * （tool/call、approval/asked），改由 wire 帧 `question/requested` /
 * `approval/requested` 驱动，UI 侧反映为会话快照的 pending 交互。因此这里
 * 订阅当前会话快照，`pending` 中出现 `question` / `approval` 等待即响；
 * 按 `key`（`q:<rpcId>` / `a:<rpcId>`）去重，回答后 key 消失可再次触发。
 * @param ctx - Client Cordis context.
 */
export function apply(ctx: ClientContext): void {
  const chime = new ThinkingChime()
  // 当前会话是否还有运行中的子代理：读 sessions 列表快照的 subagentsByParent
  // 目录（entries[].activity === 'running'）。读不到/异常时按"无子代理"处理，
  // 保持原行为（turn/end 照常响）。
  const hasRunningSubagent = (): boolean => {
    try {
      const sessions = ctx.get('sessions') as {
        list?: { getSnapshot?: () => {
          current?: string
          subagentsByParent?: Record<string, { entries?: Array<{ kind?: string; activity?: string }> }>
        } }
      } | undefined
      const state = sessions?.list?.getSnapshot?.()
      const current = state?.current
      if (typeof current !== 'string' || current === '') return false
      const catalog = state?.subagentsByParent?.[current]
      return Array.isArray(catalog?.entries)
        && catalog.entries.some((entry) => entry?.kind === 'child' && entry?.activity === 'running')
    } catch {
      return false
    }
  }
  // —— 提问/审批等待（rc.7 wire 帧驱动，快照 pending 是权威信号）——
  const sessions = ctx.get('sessions') as {
    list?: { getSnapshot?: () => { current?: string }; subscribe?: (fn: () => void) => () => void }
    binding?: (id: string) => { session?: { getSnapshot?: () => unknown; subscribe?: (fn: () => void) => () => void } } | undefined
  } | undefined
  const rungPendingKeys = new Set<string>()
  let currentFace: { getSnapshot?: () => unknown; subscribe?: (fn: () => void) => () => void } | undefined
  let detachFace: (() => void) | undefined
  const inspectPending = (): void => {
    try {
      const snapshot = currentFace?.getSnapshot?.() as { pending?: unknown } | undefined
      const pending = Array.isArray(snapshot?.pending) ? snapshot.pending : []
      const seen = new Set<string>()
      let ring = false
      for (const item of pending) {
        if (item === null || typeof item !== 'object') continue
        const record = item as { kind?: unknown; key?: unknown }
        if (record.kind !== 'question' && record.kind !== 'approval') continue
        if (typeof record.key !== 'string') continue
        seen.add(record.key)
        if (!rungPendingKeys.has(record.key)) {
          rungPendingKeys.add(record.key)
          ring = true
        }
      }
      for (const key of rungPendingKeys) if (!seen.has(key)) rungPendingKeys.delete(key)
      if (ring) chime.play()
    } catch {
      // 快照读异常不影响其他触发路径
    }
  }
  const attachSession = (id: string | undefined): void => {
    detachFace?.()
    detachFace = undefined
    currentFace = undefined
    if (id === undefined) return
    try {
      const face = sessions?.binding?.(id)?.session
      if (face === undefined || typeof face.subscribe !== 'function') return
      currentFace = face
      detachFace = face.subscribe(inspectPending)
      inspectPending()
    } catch {
      // binding 不可用：仅事件路径触发
    }
  }
  const listState = sessions?.list
  const detachList = listState?.subscribe?.(() => attachSession(listState.getSnapshot?.()?.current))
  attachSession(listState?.getSnapshot?.()?.current)
  ctx.effect(() => () => { detachList?.(); detachFace?.() }, 'ui-chime: pending watcher')

  ctx.conversationEvents.register(createRingDefinition(chime, hasRunningSubagent))
  ctx.slots.inject('conversation.input.left', () => ctx.slots.register({
    name: 'conversation.input.left',
    id: 'ui-chime-volume',
    order: 90,
    inject: () => ({
      chimeVolume: chime.getVolume(),
      onChimeVolume: (volume: number) => { chime.setVolume(volume) },
      onChimePreview: (volume: number) => { chime.preview(volume) },
    }),
  }, VolumeControl))
  ctx.effect(() => () => { chime.dispose() }, 'ui-chime: teardown')
}
