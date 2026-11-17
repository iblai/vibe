"use client";

import { createElement, useEffect, useState } from "react";
import config from "@/lib/iblai/config";
import { resolveAppTenant } from "@/lib/iblai/tenant";

/**
 * The OS agent in an iframe (`<agent-ai>` from `@iblai/agent-ai`), signed in
 * as this app's user (`authRelyOnHost`: the component reads the session this
 * app's SSO stored) with running out of credits handed to the page
 * (`handleCreditExhaustion`): instead of a modal inside the widget, the agent
 * posts a `credits.exhausted` frame, the element re-dispatches it as the
 * `creditsexhausted` DOM event, and `CreditExhaustionHandler` opens the SDK's
 * next step at page size.
 *
 * The in-process `<Chat>` (`/iblai-vibe-agent-chat`) needs none of this: it
 * runs the same credits flows itself. Reach for the embed when the agent must
 * be the OS's own chat (its sidebar, projects, settings) inside your page.
 */
export function EmbeddedAgent({
  agentId,
  className,
}: {
  /** The agent's unique id — the last path segment of its OS URL. */
  agentId: string;
  className?: string;
}) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    // Registers the custom element; a browser-only module, never at import time.
    void import("@iblai/agent-ai").then(() => {
      if (active) setReady(true);
    });
    return () => {
      active = false;
    };
  }, []);

  if (!ready) return null;

  // A custom element: React sets each prop as the element's property or
  // attribute, so the component's own names (`handleCreditExhaustion`) work.
  return createElement("agent-ai", {
    authurl: config.authUrl(),
    lmsurl: config.legacyLmsUrl(),
    tenant: resolveAppTenant(),
    mentor: agentId,
    authRelyOnHost: true,
    handleCreditExhaustion: true,
    theme: "light",
    className,
    style: { display: "block", width: "100%", height: "100%" },
  });
}
