/**
 * Volume control for the chime: a Windows-style line speaker button in the
 * composer tool row that pops a slider. The setting lives on the chime player
 * (persisted to localStorage); the component keeps a local mirror for instant
 * feedback. Clicking anywhere outside the control closes the popover.
 */

import { createElement, useEffect, useRef, useState } from 'react'
import type { PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'

/** Injected face: current volume, its setter, and an audible preview. */
export interface ChimeVolumeInjected {
  /** Initial volume in 0..1 (the chime's persisted setting). */
  readonly chimeVolume: number
  /** Apply a new volume in 0..1. */
  onChimeVolume: (volume: number) => void
  /** Preview a chime at the given volume while adjusting (audible feedback). */
  onChimePreview: (volume: number) => void
}

/** Full props of the volume control (framework runtime share + inject face). */
export type VolumeControlProps = PropsRuntime<'conversation.input.left'> & ChimeVolumeInjected

/** Windows-style line speaker glyph: body + sound arcs (or a mute cross). */
function SpeakerGlyph({ volume }: { volume: number }): ReturnType<typeof createElement> {
  const muted = volume <= 0.01
  const arcs = muted
    ? null
    : volume < 0.5
      ? createElement('path', { d: 'M15.54 8.46a5 5 0 0 1 0 7.07' })
      : createElement(
        'g',
        null,
        createElement('path', { d: 'M15.54 8.46a5 5 0 0 1 0 7.07' }),
        createElement('path', { d: 'M19.07 4.93a10 10 0 0 1 0 14.14' }),
      )
  return createElement(
    'svg',
    {
      width: '16',
      height: '16',
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke: 'currentColor',
      strokeWidth: '1.8',
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      'aria-hidden': 'true',
    },
    createElement('polygon', { points: '11 5 6 9 2 9 2 15 6 15 11 19 11 5' }),
    muted
      ? createElement('g', null,
        createElement('line', { x1: '22', y1: '9', x2: '16', y2: '15' }),
        createElement('line', { x1: '16', y1: '9', x2: '22', y2: '15' }))
      : arcs,
  )
}

const BUTTON_STYLE: Record<string, string> = {
  background: 'transparent',
  border: 'none',
  padding: '4px 6px',
  cursor: 'pointer',
  lineHeight: '0',
  color: 'inherit',
  display: 'inline-flex',
}

const POPOVER_STYLE: Record<string, string> = {
  position: 'absolute',
  bottom: 'calc(100% + 6px)',
  left: '0',
  zIndex: '30',
  // Theme-alias tokens: the popover matches the main UI surface (overlay
  // background + standard border) in both light and dark mode.
  background: 'var(--dsw-alias-bg-overlay)',
  border: '1px solid var(--dsw-alias-border-l2)',
  borderRadius: '6px',
  padding: '6px 8px',
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  // Theme-alias tokens: the popover matches the main UI surface (overlay
  // background + standard border) in both light and dark mode.
  boxShadow: 'var(--dsw-shadow-lv2)',
}

const WRAPPER_STYLE: Record<string, string> = {
  position: 'relative',
  display: 'inline-flex',
  alignItems: 'center',
}

/**
 * Speaker button + volume slider. The glyph follows the Windows line-icon
 * vocabulary (speaker body, one or two sound arcs, mute cross at 0).
 */
export function VolumeControl(props: VolumeControlProps): ReturnType<typeof createElement> {
  const [volume, setVolume] = useState(props.chimeVolume)
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement | null>(null)

  // Clicking anywhere outside the control closes the popover. The listener is
  // mounted only while open; the wrapper's subtree (button + popover) is the
  // inside, so dragging the slider or toggling the button stays alive.
  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent): void => {
      const target = event.target
      if (target instanceof Node && !wrapperRef.current?.contains(target)) {
        setOpen(false)
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => { document.removeEventListener('pointerdown', onPointerDown) }
  }, [open])

  return createElement(
    'div',
    { ref: wrapperRef, style: WRAPPER_STYLE },
    createElement(
      'button',
      {
        type: 'button',
        title: '提示音音量',
        'aria-label': '提示音音量',
        onClick: () => { setOpen(open => !open) },
        style: BUTTON_STYLE,
      },
      createElement(SpeakerGlyph, { volume }),
    ),
    open
      ? createElement(
        'div',
        { style: POPOVER_STYLE },
        createElement('input', {
          type: 'range',
          min: '0',
          max: '1',
          step: '0.05',
          value: String(volume),
          'aria-label': '提示音音量滑块',
          onChange: (event: { target: { value: string } }) => {
            const next = Number(event.target.value)
            setVolume(next)
            props.onChimeVolume(next)
            // 调节音量时播放对应音量的试听音，方便判断合适的音量
            props.onChimePreview(next)
          },
          style: { width: '72px', margin: '0' },
        }),
        createElement('span', { style: { fontSize: '11px', minWidth: '22px', textAlign: 'right' } },
          `${Math.round(volume * 100)}%`),
      )
      : null,
  )
}
