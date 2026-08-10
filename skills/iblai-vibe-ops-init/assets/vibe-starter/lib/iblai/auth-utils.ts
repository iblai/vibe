
/**
 * ibl.ai auth helper utilities.
 *
 * These are thin wrappers used by IblaiProviders. You can customise the
 * redirect behaviour here without touching the provider component.
 */

import config from "./config";
import { resolveAppTenant } from "./tenant";

/** Check if running inside a Tauri app. */
export function isTauri(): boolean {
  if (typeof window === "undefined") return false;
  return "__TAURI_INTERNALS__" in window || "__TAURI__" in window;
}

/** Check if running inside a Tauri mobile app (iOS/Android). */
export function isTauriMobile(): boolean {
  if (!isTauri()) return false;
  return /android|iphone|ipad|ipod/i.test(navigator.userAgent);
}

/** Get the redirect origin for the Auth SPA.
 *  - Mobile Tauri: custom scheme (e.g. `iblai-skills://`)
 *  - Desktop Tauri / Web: window.location.origin
 */
function getRedirectOrigin(): string {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  if (isTauriMobile()) {
    const scheme = config.tauriCustomScheme();
    if (scheme) return `${scheme}://`;
  }
  return origin;
}

/** Redirect the browser to the ibl.ai Auth SPA for login. */
export async function redirectToAuthSpa(
  redirectTo?: string,
  platformKey?: string,
  logout?: boolean,
  saveRedirect?: boolean,
) {
  const redirectOrigin = getRedirectOrigin();
  const path = redirectTo ?? (typeof window !== "undefined" ? window.location.pathname : "/");

  if (saveRedirect) {
    localStorage.setItem("redirectTo", path);
  }

  const tenant = platformKey || resolveAppTenant();
  let authUrl = `${config.authUrl()}/login?app=custom&redirect-to=${redirectOrigin}`;
  if (tenant) authUrl += `&tenant=${encodeURIComponent(tenant)}`;
  if (logout) authUrl += "&logout=1";

  // All platforms (web, desktop Tauri, mobile Tauri): navigate the window
  // to the Auth SPA.  On desktop Tauri the auth page loads in-app, and
  // the Rust on_navigation filter opens OAuth providers (Google, Apple)
  // in a popup window automatically.
  window.location.href = authUrl;
}

/** Check whether a non-expired auth token exists in localStorage. */
export function hasNonExpiredAuthToken(): boolean {
  if (typeof window === "undefined") return false;
  const token = localStorage.getItem("axd_token");
  if (!token) return false;
  const expiry = localStorage.getItem("axd_token_expires");
  if (!expiry) return false;
  return new Date(expiry) > new Date();
}

/** Handle logout: clear state and redirect to the Auth SPA logout page. */
export function handleLogout() {
  const tenant = resolveAppTenant();
  const redirectOrigin = getRedirectOrigin();
  localStorage.clear();
  window.location.href = `${config.authUrl()}/logout?redirect-to=${redirectOrigin}&tenant=${encodeURIComponent(tenant)}`;
}
