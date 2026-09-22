# Chat — known SDK issues and host workarounds

Moved out of `SKILL.md` to keep the skill scannable; this is the full text.

## Known issues & host workarounds

These are SDK-side defects/limitations confirmed against
`web-containers@1.6.14` / `web-utils@1.6.9`. Fix upstream if you can;
otherwise apply the host workaround.

### Voice "Processing…" hangs forever (React StrictMode / remounts)

`useVoiceChat`'s `isMounted` ref is only ever reset to `false` (effect
cleanup), never back to `true` on setup. React StrictMode (Next default)
double-invokes effects in dev (mount→cleanup→remount) → the ref stays
`false` → audio-to-text resolves but the `isMounted`-guarded
`setProcessing(false)` is skipped → stuck "Processing…". Any `<Chat>`
remount reproduces it.

- **Workaround:** `reactStrictMode: false` in `next.config` (dev-only
  behavior; prod runs effects once) **and** follow "Mounting
  discipline" so `<Chat>` doesn't remount.
- **Real fix (upstream):** add `isMounted.current = true;` to the
  effect setup in `useVoiceChat`.

### Prompt-gallery dialog wedges the whole app

The bundled `PromptGalleryModal` is a Radix dialog whose teardown leaves
`document.body { pointer-events: none }` and sibling
`inert`/`aria-hidden` after close → the entire app becomes unclickable.
The `promptGalleryModal` slot override **does not exist** in this SDK
(see Props), so it can't be replaced via API.

- **Workaround:** mount a global recovery component at the app root that
  clears the stuck lock **only when no Radix dialog is open** (no-op
  while a modal is legitimately open):

```tsx
"use client";
import { useEffect } from "react";
const OPEN = '[role="dialog"][data-state="open"],[role="alertdialog"][data-state="open"],[data-radix-popper-content-wrapper]';
function recover() {
  if (document.querySelector(OPEN)) return;
  if (document.body.style.pointerEvents === "none") document.body.style.pointerEvents = "";
  for (const el of Array.from(document.body.children)) {
    if (el.hasAttribute("inert")) el.removeAttribute("inert");
    if (el.getAttribute("aria-hidden") === "true") el.removeAttribute("aria-hidden");
  }
}
export function RadixPointerEventsGuard() {
  useEffect(() => {
    recover();
    const mo = new MutationObserver(recover);
    mo.observe(document.body, { attributes: true, attributeFilter: ["style","inert","aria-hidden"], childList: true, subtree: true });
    const onDown = () => recover();
    document.addEventListener("pointerdown", onDown, true);
    return () => { mo.disconnect(); document.removeEventListener("pointerdown", onDown, true); };
  }, []);
  return null;
}
```

  Mount it once next to your store/providers. This is recovery, not a
  root-cause fix — the gallery still tears down wrong, but the app stays
  usable.
- **Real fix (upstream):** correct the dialog teardown, or actually
  implement the `promptGalleryModal` slot so hosts can supply a
  cleanly-unmounting modal.
