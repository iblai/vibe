"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AgentSearch } from "@iblai/iblai-js/web-containers/next";
import config from "@/lib/iblai/config";
import { resolveAppTenant } from "@/lib/iblai/tenant";
import { useAdminMode } from "@/lib/iblai/admin-mode";

/**
 * Browse the agents this user can reach — starred, featured, the org's own,
 * and all — and start a chat with one. Admins in Admin mode also get the
 * SDK's "Create agent" action, which goes through /setup's create step.
 */
export default function AgentsPage() {
  const router = useRouter();
  const { adminMode } = useAdminMode();
  const [tenantKey, setTenantKey] = useState("");
  const [username, setUsername] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("userData");
      if (raw) {
        const parsed = JSON.parse(raw);
        setUsername(parsed.user_nicename ?? parsed.username ?? "");
      }
    } catch {}
    setTenantKey(resolveAppTenant());
  }, []);

  if (!tenantKey) return null;

  return (
    <div className="mx-auto w-full flex-1 overflow-auto px-4 py-8 md:w-[75vw] md:px-0">
      <div className="rounded-lg border border-[var(--border-color)] bg-white overflow-hidden">
        <AgentSearch
          tenantKey={tenantKey}
          username={username}
          mainTenantKey={config.mainTenantKey()}
          onAgentClick={(agent) =>
            router.push(`/?agent=${encodeURIComponent(agent.unique_id)}&new=${Date.now()}`)
          }
          onCreateAgent={adminMode ? () => router.push("/setup?step=agent") : undefined}
        />
      </div>
    </div>
  );
}
