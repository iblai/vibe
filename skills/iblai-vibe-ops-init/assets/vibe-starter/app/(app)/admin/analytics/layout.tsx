"use client";

import { AnalyticsLayout, AnalyticsSettingsProvider } from "@iblai/iblai-js/web-containers";
import { usePathname, useRouter } from "next/navigation";

/**
 * Org-wide analytics with the SDK's tab strip (Overview, Users, Topics,
 * Transcripts, Financial, Reports). Each tab is a route below.
 */
export default function AdminAnalyticsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "/admin/analytics";
  const router = useRouter();
  const basePath = "/admin/analytics";

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col">
      <AnalyticsSettingsProvider value={{}}>
        <AnalyticsLayout
          currentPath={pathname}
          basePath={basePath}
          onTabChange={(tab: string) => router.push(tab ? `${basePath}/${tab}` : basePath)}
        >
          {children}
        </AnalyticsLayout>
      </AnalyticsSettingsProvider>
    </div>
  );
}
