/**
 * Browser chime player: a short two-note "ding" synthesized with the Web Audio
 * API — no asset file, no network. Volume (0..1) is applied to the note
 * envelopes and persisted to localStorage so a refresh keeps the setting.
 *
 * Autoplay policy: a suspended `AudioContext` only starts after a user
 * gesture, so the engine registers capture-phase unlock listeners (pointer /
 * key) at construction and re-arms on every play. Before the first gesture the
 * chime is a silent no-op; afterwards every trigger rings. A rate limiter
 * coalesces bursts into at most one chime per short window.
 */

/** localStorage key for the persisted volume (0..1). */
const VOLUME_KEY = 'dsh.ui-chime.volume'
/** Default volume when nothing is stored. */
const DEFAULT_VOLUME = 0.6
/** Minimum gap between two audible chimes (burst guard). */
const MIN_INTERVAL_MS = 250
/** Minimum gap between two volume-preview chimes (drag feedback guard). */
const PREVIEW_INTERVAL_MS = 150

/** Notes of the chime, earliest first. Frequencies: A5 then E6 (a fifth up). */
export interface ChimeNote {
  readonly frequency: number
  /** Seconds from the play time to the note's attack. */
  readonly delay: number
  /** Seconds from the note's attack to its decay tail. */
  readonly duration: number
  /** Peak gain (0..1) of the note's envelope. */
  readonly peak: number
}

/** The two ascending notes that make up one chime. */
export const CHIME_NOTES: readonly ChimeNote[] = [
  { frequency: 880, delay: 0, duration: 0.28, peak: 0.3 },
  { frequency: 1318.51, delay: 0.14, duration: 0.42, peak: 0.22 },
]

/** Exponential attack ramp in seconds (keeps the onset click-free). */
const ATTACK_SECONDS = 0.012
/** Silence after the last note before the oscillator is stopped. */
const STOP_TAIL_SECONDS = 0.05

/** Minimal AudioContext surface the chime touches (runtime guard + test seam). */
export interface ChimeAudioContext {
  readonly currentTime: number
  readonly state: AudioContextState
  readonly destination: AudioDestinationNode
  createOscillator(): OscillatorNode
  createGain(): GainNode
  resume(): Promise<void>
  close(): Promise<void>
}

/** Creates one chime-capable audio context (injectable for tests). */
type AudioContextFactory = () => ChimeAudioContext

/** The platform factory, when the environment provides an AudioContext. */
function resolveAudioContextFactory(): AudioContextFactory | undefined {
  if (typeof window === 'undefined') return undefined
  const candidate = (window as Window & { AudioContext?: new () => ChimeAudioContext }).AudioContext
  return candidate === undefined ? undefined : () => new candidate()
}

/** Read the persisted volume, clamping to 0..1. */
function readStoredVolume(storage: Pick<Storage, 'getItem'> | undefined): number {
  try {
    const raw = storage?.getItem(VOLUME_KEY)
    if (raw === null || raw === undefined) return DEFAULT_VOLUME
    const value = Number(raw)
    if (!Number.isFinite(value)) return DEFAULT_VOLUME
    return Math.min(1, Math.max(0, value))
  } catch {
    return DEFAULT_VOLUME
  }
}

/**
 * Schedule one chime on an audio context at `when` (its timeline seconds),
 * scaled by `volume` (0..1). Exported for direct testing against a stub.
 * @param context - the running (or about-to-run) audio context.
 * @param when - timeline seconds at which the chime starts.
 * @param volume - loudness in 0..1 (1 = full envelope).
 */
export function scheduleChime(context: ChimeAudioContext, when: number, volume: number): void {
  for (const note of CHIME_NOTES) {
    const oscillator = context.createOscillator()
    oscillator.type = 'sine'
    oscillator.frequency.value = note.frequency
    const gain = context.createGain()
    const peak = note.peak * volume
    const start = when + note.delay
    gain.gain.setValueAtTime(0.0001, start)
    gain.gain.exponentialRampToValueAtTime(peak, start + ATTACK_SECONDS)
    gain.gain.exponentialRampToValueAtTime(0.0001, start + note.duration)
    oscillator.connect(gain)
    gain.connect(context.destination)
    oscillator.start(start)
    oscillator.stop(start + note.duration + STOP_TAIL_SECONDS)
  }
}

/**
 * One chime player bound to a window with a persisted volume. Create once per
 * plugin apply; dispose with the plugin.
 */
export class ThinkingChime {
  private context: ChimeAudioContext | null = null
  // Negative infinity so the first play is never coalesced away.
  private lastPlayedAt = Number.NEGATIVE_INFINITY
  // Negative infinity so the first preview is never coalesced away.
  private lastPreviewAt = Number.NEGATIVE_INFINITY
  private volume: number

  /** Re-arm the context after any user gesture. */
  private readonly handleUnlock = (): void => { void this.resume() }

  /**
   * @param windowRef - the browsing window (injectable for tests).
   * @param createAudioContext - platform factory (injectable for tests; absent
   *   environments simply never ring).
   * @param now - monotonic-ish ms clock (injectable for tests).
   * @param storage - localStorage-like backing (injectable for tests; absent
   *   storage keeps the default volume).
   */
  constructor(
    private readonly windowRef: Window = window,
    private readonly createAudioContext: AudioContextFactory | undefined = resolveAudioContextFactory(),
    private readonly now: () => number = () => Date.now(),
    storage: Pick<Storage, 'getItem' | 'setItem'> | undefined = typeof localStorage === 'undefined' ? undefined : localStorage,
  ) {
    this.volume = readStoredVolume(storage)
    this.windowRef.addEventListener('pointerdown', this.handleUnlock, { capture: true })
    this.windowRef.addEventListener('keydown', this.handleUnlock, { capture: true })
    this.storage = storage
  }

  private readonly storage: Pick<Storage, 'getItem' | 'setItem'> | undefined

  /** Current volume in 0..1. */
  getVolume(): number {
    return this.volume
  }

  /**
   * Set the volume (0..1) and persist it.
   * @param volume - the new loudness, clamped to 0..1.
   */
  setVolume(volume: number): void {
    this.volume = Math.min(1, Math.max(0, volume))
    try {
      this.storage?.setItem(VOLUME_KEY, String(this.volume))
    } catch {
      // Storage failures never break the chime.
    }
  }

  /**
   * Best-effort resume: create the context on first use, then run it. Failures
   * (autoplay policy, missing support) stay silent — the chime must never
   * throw into the event stream.
   */
  private resume(): Promise<void> {
    if (this.context === null) {
      if (this.createAudioContext === undefined) return Promise.resolve()
      try {
        this.context = this.createAudioContext()
      } catch {
        return Promise.resolve()
      }
    }
    if (this.context.state !== 'running') {
      return this.context.resume().catch(() => {})
    }
    return Promise.resolve()
  }

  /**
   * Ring the chime, coalescing bursts. Safe to call from any event handler.
   */
  play(): void {
    const now = this.now()
    if (now - this.lastPlayedAt < MIN_INTERVAL_MS) return
    this.lastPlayedAt = now
    const volume = this.volume
    void this.resume().then(() => {
      const context = this.context
      if (context === null) return
      scheduleChime(context, context.currentTime, volume)
    })
  }

  /**
   * Preview a chime at the given volume without touching the persisted
   * setting. Used by the volume control so the user hears the level while
   * dragging the slider; a short throttle keeps a drag from stacking a
   * burst of notes. At volume 0 the notes are inaudible, which is fine.
   * @param volume - loudness in 0..1, clamped before playback.
   */
  preview(volume: number): void {
    const now = this.now()
    if (now - this.lastPreviewAt < PREVIEW_INTERVAL_MS) return
    this.lastPreviewAt = now
    const level = Math.min(1, Math.max(0, volume))
    void this.resume().then(() => {
      const context = this.context
      if (context === null) return
      scheduleChime(context, context.currentTime, level)
    })
  }

  /** Release the audio context and gesture listeners. */
  dispose(): void {
    this.windowRef.removeEventListener('pointerdown', this.handleUnlock, { capture: true })
    this.windowRef.removeEventListener('keydown', this.handleUnlock, { capture: true })
    const context = this.context
    this.context = null
    if (context !== null) void context.close().catch(() => {})
  }
}
