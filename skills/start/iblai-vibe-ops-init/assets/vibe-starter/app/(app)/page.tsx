"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Chat, type ChatConfig } from "@iblai/iblai-js/web-containers/next";
import {
  useUsername,
  useAxdToken,
  useUserTenants,
  useVisitingTenant,
  useCachedSessionId,
  sessionCacheKey,
} from "@iblai/iblai-js/web-utils";
import { Bot } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { redirectToAuthSpa } from "@/lib/iblai/auth-utils";
import config from "@/lib/iblai/config";
import { resolveAppTenant } from "@/lib/iblai/tenant";
import { useAdminMode } from "@/lib/iblai/admin-mode";
import { useOrgSettings } from "@/lib/iblai/metadata";

/**
 * Home = a conversation with the app's agent.
 *
 * Which agent: `?agent=<uuid>` (from /agents) → NEXT_PUBLIC_DEFAULT_AGENT_ID →
 * the org setting an admin saved on /setup. With none of the three, an honest
 * empty state instead of a broken chat.
 */
export default function HomePage() {
  // useSearchParams() needs a Suspense boundary in the App Router.
  return (
    <Suspense fallback={null}>
      <AgentChat />
    </Suspense>
  );
}

function AgentChat() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAdmin, adminMode } = useAdminMode();
  const { settings: org, isLoading: orgLoading } = useOrgSettings();

  const mentorId =
    searchParams.get("agent") || config.defaultAgentId() || org.defaultAgentId || "";

  // Resume (`?session=<id>`) or new chat (`?new=<nonce>`). The SDK reads its
  // cached-session map, keyed by `sessionCacheKey(org, agent)`, once at <Chat>
  // mount, so seed or clear that entry before mounting and key <Chat> on the
  // params so a switch remounts it.
  // That key is the ONLY legitimate remount: any other remount wedges voice.
  const restoreSessionId = searchParams.get("session") ?? undefined;
  const newParam = searchParams.get("new") ?? undefined;
  const [tenantKey] = useState(resolveAppTenant);
  const [cachedSessionId, saveCachedSessionId] = useCachedSessionId();
  const [seededFor, setSeededFor] = useState<string | undefined>(
    restoreSessionId || newParam ? undefined : "none",
  );
  useEffect(() => {
    if (!mentorId || !tenantKey) {
      setSeededFor("none");
      return;
    }
    const key = sessionCacheKey(tenantKey, mentorId);
    const map = { ...((cachedSessionId ?? {}) as Record<string, string>) };
    if (restoreSessionId) {
      if (map[key] !== restoreSessionId) {
        saveCachedSessionId({ ...map, [key]: restoreSessionId });
      }
      setSeededFor(restoreSessionId);
    } else if (newParam) {
      if (map[key]) {
        delete map[key];
        saveCachedSessionId(map);
      }
      setSeededFor(`new:${newParam}`);
    } else {
      setSeededFor("none");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restoreSessionId, newParam, mentorId, tenantKey]);
  const sessionReady = restoreSessionId
    ? seededFor === restoreSessionId
    : newParam
      ? seededFor === `new:${newParam}`
      : true;

  const username = useUsername();
  const axdToken = useAxdToken();
  const { userTenants } = useUserTenants();
  const { visitingTenant } = useVisitingTenant();

  const chatConfig: ChatConfig = {
    baseWsUrl: () => config.baseWsUrl(),
    supportEmail: () => config.supportEmail(),
    authUrl: () => config.authUrl(),
    mainTenantKey: config.mainTenantKey(),
    navigateToAdminBilling: () => router.push("/admin/billing"),
    navigateToExplore: () => router.push("/agents"),
    navigateToMentor: (id: string) => router.push(`/?agent=${encodeURIComponent(id)}`),
  };

  if (!tenantKey) return null;
  if (!mentorId) {
    if (orgLoading) return null;
    return <NoAgentYet isAdmin={isAdmin} />;
  }
  if (!sessionReady) return null;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Chat
        key={`${mentorId}:${restoreSessionId ?? ""}:${newParam ?? ""}`}
        isPreviewMode={false}
        mentorId={mentorId}
        tenantKey={tenantKey}
        config={chatConfig}
        redirectToAuthSpa={(to, key, logout) => void redirectToAuthSpa(to, key, logout)}
        username={username ?? null}
        userTenants={userTenants ?? []}
        visitingTenant={visitingTenant}
        axdToken={axdToken ?? ""}
        userIsStudent={!adminMode}
      />
    </div>
  );
}

function NoAgentYet({ isAdmin }: { isAdmin: boolean }) {
  return (
    <div className="flex flex-1 items-center justify-center p-8">
      <EmptyState
        className="w-full max-w-md flex-none"
        icon={<Bot strokeWidth={1.75} />}
        title="No agent yet"
        description={
          isAdmin
            ? "Pick one of your organization's agents or create a new one. It becomes what this page chats with."
            : "An admin hasn't chosen this app's agent yet. Ask them to finish setup, or browse the agents you already have access to."
        }
        action={
          <div className="flex justify-center gap-3">
            <Link
              href="/agents"
              className="inline-flex items-center rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-accent"
            >
              Pick an agent
            </Link>
            {isAdmin && (
              <Link href="/setup" className="ibl-button-primary inline-flex items-center rounded-lg px-4 py-2 text-sm font-medium">
                Set up
              </Link>
            )}
          </div>
        }
      />
    </div>
  );
}
