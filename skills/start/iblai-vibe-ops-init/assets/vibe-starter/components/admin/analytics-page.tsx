"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  AnalyticsFinancialStats,
  AnalyticsOverview,
  AnalyticsReports,
  AnalyticsTopicsStats,
  AnalyticsTranscriptsStats,
  AnalyticsUsersStats,
} from "@iblai/iblai-js/web-containers";
import { resolveAppTenant } from "@/lib/iblai/tenant";

type Tab = "overview" | "users" | "topics" | "transcripts" | "financial" | "reports";

/**
 * One analytics tab. Org-wide by default; `?agent=<uuid>` scopes every tab to
 * that agent (the SDK passes it as `mentor_unique_id`).
 */
export function AnalyticsPage({ tab }: { tab: Tab }) {
  return (
    <Suspense fallback={null}>
      <AnalyticsTab tab={tab} />
    </Suspense>
  );
}

function AnalyticsTab({ tab }: { tab: Tab }) {
  const params = useSearchParams();
  const agent = params.get("agent") ?? "";
  const [tenantKey, setTenantKey] = useState("");
  useEffect(() => {
    setTenantKey(resolveAppTenant());
  }, []);
  if (!tenantKey) return null;

  const common = { tenantKey, mentorId: agent, selectedMentorId: agent };
  switch (tab) {
    case "users":
      return <AnalyticsUsersStats {...common} />;
    case "topics":
      return <AnalyticsTopicsStats {...common} />;
    case "transcripts":
      return <AnalyticsTranscriptsStats {...common} />;
    case "financial":
      return <AnalyticsFinancialStats {...common} />;
    case "reports":
      return <AnalyticsReports tenantKey={tenantKey} selectedMentorId={agent} />;
    default:
      return <AnalyticsOverview {...common} />;
  }
}
