import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { config } from "./config";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function isTauri(): boolean {
  if (typeof window === "undefined") return false;
  return "__TAURI_INTERNALS__" in window || "__TAURI__" in window;
}

export function isTauriMobile(): boolean {
  if (!isTauri()) return false;
  return /android|iphone|ipad|ipod/i.test(navigator.userAgent);
}

function getRedirectOrigin(): string {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  if (isTauriMobile()) {
    const scheme = config.tauriCustomScheme();
    if (scheme) return `${scheme}://`;
  }
  return origin;
}

/**
 * Redirect to the Auth SPA for login/logout
 */
export async function redirectToAuthSpa(
  redirectTo?: string,
  platformKey?: string,
  logout?: boolean,
  saveRedirect = true
): Promise<void> {
  const AUTH_URL = config.authUrl();
  const AGENT_URL = config.agentUrl();
  const tenant = platformKey || config.mainTenantKey();

  if (logout) {
    localStorage.clear();
  }

  if (saveRedirect && !logout) {
    const currentPath = window.location.pathname + window.location.search;
    localStorage.setItem("redirectTo", currentPath);
  }

  const redirectOrigin = getRedirectOrigin();
  let authUrl = `${AUTH_URL}/login?app=agent&redirect-to=${redirectTo || redirectOrigin || AGENT_URL}`;
  if (tenant) authUrl += `&tenant=${encodeURIComponent(tenant)}`;
  if (logout) authUrl += "&logout=1";

  window.location.href = authUrl;
}
