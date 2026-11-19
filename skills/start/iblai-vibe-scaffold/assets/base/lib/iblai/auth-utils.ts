/**
 * Re-export auth utilities for ibl.ai feature components.
 *
 * This shim lets feature components (chat, profile, etc.) import from
 * "@/lib/iblai/auth-utils" regardless of how the project's auth files
 * were laid out.
 */

import { config } from "@/lib/config";
import { resolveAppTenant } from "@/lib/iblai/tenant";

export { redirectToAuthSpa } from "@/lib/utils";

/** Check whether a non-expired auth token exists in localStorage. */
export function hasNonExpiredAuthToken(): boolean {
  if (typeof window === "undefined") return false;
  const token = localStorage.getItem("axd_token");
  if (!token) return false;
  const expiry = localStorage.getItem("axd_token_expires");
  if (!expiry) return false;
  return new Date(expiry) > new Date();
}

/** Clear state and redirect to the Auth SPA logout page. */
export function handleLogout() {
  const tenant = resolveAppTenant();
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  localStorage.clear();
  window.location.href = `${config.authUrl()}/logout?redirect-to=${origin}&tenant=${tenant}`;
}

/**
 * The login page with this app nested inside: where the platform returns a
 * person after a Stripe checkout. The checkout appends a sign-in token the
 * login page consumes, then it comes back to `origin`. The pricing session
 * only accepts a return URL on a domain it allows, and the login host is one;
 * an app's own domain is refused (400 "Redirect URL domain is not allowed").
 */
export function loginReturnUrl(origin: string = config.appUrl()): string {
  return `${config.authUrl()}/login?app=custom&redirect-to=${encodeURIComponent(origin)}`;
}
