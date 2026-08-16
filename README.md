# @uachar/dsh-ui-chime

A browser chime plugin for **DeepSeek Harness**: a short synthesized "ding" plays when the model reaches a boundary you care about — a completed turn, or a point where it is waiting for you. No audio assets, no session-log writes, no changes to the dsh core; installed as a standalone package.

## Features

- Rings when **a full turn completes** (`turn/end` with `completed` / `max-tokens`) — the intermediate thinking phases of multi-step turns stay silent.
- Rings when **an approval is requested** (`approval/asked`) — the model is waiting on a permission decision.
- Rings when **the model calls `ask_user_question`** (`tool/call`) — it is waiting for you to pick an option.
- **Volume control** with instant preview; setting persists across sessions.
- Synthesized with Web Audio (oscillators + gain envelope) — **zero audio files**, no added asset weight.
- History replay (opening a session, pagination, reconnect) never rings: an event counts as live only if it is within 10 seconds of now.

## How to use

- **Volume control**: the composer tool row has a speaker button (Windows-style line icon) on the left; click it to open a slider. **Dragging the slider plays a preview chime at the new volume**, so you can hear the level as you adjust. The setting persists in `localStorage` (`dsh.ui-chime.volume`).
- **Autoplay policy**: browsers keep `AudioContext` suspended until the first user gesture, so the chime is silent before the page has been clicked once — click anywhere and it works afterwards.

## Installation & removal

> Requires a working `dsh` CLI (pnpm) and a profile, e.g. `web`.

### Install from npm (recommended)

```sh
pnpm dsh plugin --profile web add @uachar/dsh-ui-chime
```

### Install from the GitHub release tarball

```sh
pnpm dsh plugin --profile web add https://github.com/uAcharGG/dsh-ui-chime/releases/download/v0.1.0/uachar-dsh-ui-chime-0.1.0.tgz
```

### Build & install from source

```sh
git clone https://github.com/uAcharGG/dsh-ui-chime.git
cd dsh-ui-chime
pnpm install
pnpm run build        # tsc -> tsdown; emits lib/index.js and lib/client.js
pnpm dsh plugin --profile web add link:<absolute path to this checkout>
```

Restart `dsh` after any install to take effect.

### Removal

```sh
pnpm dsh plugin --profile web remove @uachar/dsh-ui-chime
```

Then restart `dsh`. (Enable/disable via the manager panel only edits the composition layer without removing the code.)

## Project structure

| File | Purpose |
|---|---|
| `cordis.patch.yml` | bundle composition layer: inserts the plugin as one `ui-chime` row |
| `src/index.ts` | host half: empty apply (so the row appears in the Host loader / `dsh.client` scan) |
| `src/client/index.ts` | browser half: headless Conversation Definition (ring triggers) + volume control registration |
| `src/client/chime.ts` | Web Audio synthesis engine + persisted volume |
| `src/client/volume-control.tsx` | speaker button and volume slider in the composer tool row |
| `lib/` | build output (published) |

## Limitations

- **Autoplay policy** — the first chime before any user gesture is silently skipped (the unlock listeners make the next one ring).
- **Boundary events only** — the triggers are `turn/end`, `approval/asked`, and `ask_user_question` tool calls; a step interrupted mid-reasoning never rings.
- **No per-session control** — the chime rings for every session at one loudness (volume is global, persisted in localStorage).

## License

MIT
