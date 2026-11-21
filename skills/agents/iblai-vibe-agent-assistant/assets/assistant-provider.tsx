"use client";

import type { ReactNode } from "react";
import { MasterAgentProvider } from "@iblai/iblai-js/web-containers";
import { isLoggedIn, useEmbedMode } from "@iblai/iblai-js/web-utils";
import config from "@/lib/iblai/config";

/**
 * The Assistant's state for the app shell (the SDK's `MasterAgentProvider`):
 * which agent the header button opens, whether the panel is open, and its
 * width. Wrap the header that shows `MasterAgent` and the row that shows
 * `MasterAgentPanel` (`app/(app)/layout.tsx`), so the panel stays open while
 * the user moves between pages.
 *
 * The panel shows the agent through `<agent-ai>`, which loads the ibl.ai
 * app's embed page and signs it in as this app's user. That page is not in
 * vibe-starter, so `mentorUrl` points at the hosted app (`mentorai.<domain>`,
 * the same app as os.ibl.ai on iblai.app). The SDK's default, this page's own
 * origin, is for the ibl.ai app itself.
 */
export function AssistantProvider({
  tenantKey,
  username,
  agentId,
  children,
}: {
  tenantKey: string;
  username?: string;
  /**
   * Opens this agent. Left out, the SDK picks the organization's Default
   * Agent, else the user's starred agent, else the one they used last.
   */
  agentId?: string;
  children: ReactNode;
}) {
  // Inside an embed of this app, a second agent beside the page is noise.
  const embedded = useEmbedMode();

  return (
    <MasterAgentProvider
      tenant={tenantKey}
      username={username ?? ""}
      authUrl={config.authUrl()}
      lmsUrl={config.legacyLmsUrl()}
      mentorUrl={`https://mentorai.${config.platformBaseDomain()}`}
      agentId={agentId}
      enabled={!embedded && !!tenantKey && !!username && isLoggedIn()}
    >
      {children}
    </MasterAgentProvider>
  );
}
