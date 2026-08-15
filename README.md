# dsh-ui-chime

A browser chime for **DeepSeek Harness**: a short synthesized "ding" plays whenever the model reaches a boundary the user cares about — a completed turn, or a point where it is waiting for the user. No audio assets, no session-log writes, no changes to the dsh core; installed and managed through dsh-launcher as a standalone package.

## When it rings

- **A full turn completes** (`turn/end` with `completed` / `max-tokens`) — the intermediate thinking phases of multi-step turns stay silent.
- **An approval is requested** (`approval/asked`) — the model is waiting on a permission decision.
- **The model calls `ask_user_question`** (`tool/call`) — it is waiting for the user to pick an option.

History replay (opening a session, pagination, reconnect) never rings: an event counts as live only if it is within 10 seconds of now.

## How to use

- **Volume control**: the composer tool row has a speaker button (Windows-style line icon) on the left; click it to open a slider. The setting persists in `localStorage`. **Dragging the slider plays a preview chime at the new volume**, so you can hear the level as you adjust.
- **Autoplay policy**: browsers keep `AudioContext` suspended until the first user gesture, so the chime is silent before the page has been clicked once — click anywhere and it works afterwards.

## Installation / removal

Install through dsh-launcher (local path → `D:\Pro\dsh-ui-chime`), or manually:

```sh
pnpm dsh plugin --profile web add link:D:\Pro\dsh-ui-chime
```

Restart `dsh` to take effect. To remove: uninstall from the panel (or `pnpm dsh plugin --profile web remove @uachar/dsh-ui-chime`) and restart. Enable/disable just edits the composition layer without removing the code.

## Structure

| File | Purpose |
|---|---|
| `cordis.patch.yml` | bundle composition layer: inserts the plugin as one `ui-chime` row |
| `src/index.ts` | node half: empty apply (so the row appears in the Host loader / `dsh.client` scan) |
| `src/client/index.ts` | browser half: headless Conversation Definition (ring triggers) + volume control registration |
| `src/client/chime.ts` | Web Audio synthesis engine + persisted volume |
| `src/client/volume-control.tsx` | speaker button and volume slider in the composer tool row |

## Building

```sh
pnpm install
pnpm run build        # tsc -> tsdown; emits lib/index.js and lib/client.js
```

## Known limitations

- **Autoplay policy** — the first chime before any user gesture is silently skipped (the unlock listeners make the next one ring).
- **Boundary events only** — the triggers are `turn/end`, `approval/asked`, and `ask_user_question` tool calls; a step interrupted mid-reasoning never rings.
- **No per-session control** — the chime rings for every session at one loudness (volume is global, persisted in localStorage).

## License

MIT
