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
 * @param chime - the chime player.
 * @returns the definition to register.
 */
export function createRingDefinition(chime: ThinkingChime): ConversationNodeDefinition<Record<string, never>> {
  return {
    kind: 'ui-chime-ring',
    match: (event) => isRingEvent(event) ? { id: `ring-${event.seq}`, role: 'start' } : null,
    start: (_context, match) => {
      const event = match.event
      if (Date.now() - event.time <= LIVE_GRACE_MS) chime.play()
      return {}
    },
    update: (context) => context.state,
    publication: () => 'none',
  }
}

/** Required services: the conversation Definition registry and the slots registry. */
export const inject = ['conversationEvents', 'slots']

/**
 * Browser plugin body: register the ring Definition and the volume control.
 * @param ctx - Client Cordis context.
 */
export function apply(ctx: ClientContext): void {
  const chime = new ThinkingChime()
  ctx.conversationEvents.register(createRingDefinition(chime))
  ctx.slots.inject('conversation.input.left', () => ctx.slots.register({
    name: 'conversation.input.left',
    id: 'ui-chime-volume',
    order: 90,
    inject: () => ({
      chimeVolume: chime.getVolume(),
      onChimeVolume: (volume: number) => { chime.setVolume(volume) },
    }),
  }, VolumeControl))
  ctx.effect(() => () => { chime.dispose() }, 'ui-chime: teardown')
}
