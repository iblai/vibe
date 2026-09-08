"use client";
import { useEffect } from "react";

// Host recovery for an SDK defect: the bundled prompt-gallery dialog tears down
// leaving `document.body { pointer-events: none }` and stray `inert` /
// `aria-hidden` on siblings, which makes the whole app unclickable. Clears the
// lock only when no Radix dialog is open. Recovery, not a root-cause fix.
const OPEN =
  '[role="dialog"][data-state="open"],[role="alertdialog"][data-state="open"],[data-radix-popper-content-wrapper]';
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
    mo.observe(document.body, {
      attributes: true,
      attributeFilter: ["style", "inert", "aria-hidden"],
      childList: true,
      subtree: true,
    });
    const onDown = () => recover();
    document.addEventListener("pointerdown", onDown, true);
    return () => {
      mo.disconnect();
      document.removeEventListener("pointerdown", onDown, true);
    };
  }, []);
  return null;
}
