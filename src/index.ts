/**
 * Thinking-end chime plugin, node half. Pure browser-side capability: the
 * empty apply exists so the row appears in the host cordis.yml / Loader,
 * while the browser half ships through exports["./client"], discovered from
 * the package.json dsh.client declaration. All triggering logic lives in the
 * browser half (Conversation Definition over the session event stream).
 */

/** Host plugin body — this package contributes nothing host-side. */
export function apply(): void {}
