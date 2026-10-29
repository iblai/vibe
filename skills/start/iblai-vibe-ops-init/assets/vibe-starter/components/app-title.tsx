"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useOrgSettings } from "@/lib/iblai/metadata";

/**
 * Puts the name an admin saved on /setup in the browser tab. The server renders
 * NEXT_PUBLIC_APP_NAME (else the slug): reading the org's metadata there would
 * hold every page's load on a platform call.
 */
export function AppTitle() {
  const { settings } = useOrgSettings();
  const pathname = usePathname();
  useEffect(() => {
    if (settings.appName) document.title = settings.appName;
  }, [settings.appName, pathname]);
  return null;
}
