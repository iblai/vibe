"use client";

/**
 * ibl.ai Provider wrapper.
 *
 * Wrap your root layout children with <IblaiProviders> to get:
 *  - Redux store (RTK Query for IBL APIs)
 *  - AuthProvider  (SSO redirect, JWT validation, cross-SPA sync)
 *  - TenantProvider (multi-tenant routing)
 *
 * Usage in app/layout.tsx:
 *
 *   import { IblaiProviders } from "@/providers/iblai-providers";
 *   export default function RootLayout({ children }) {
 *     return <html><body><IblaiProviders>{children}</IblaiProviders></body></html>;
 *   }
 */

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Provider as ReduxProvider } from "react-redux";
import { usePathname } from "next/navigation";
import {
  initializeDataLayer,
  type TokenResponse,
} from "@iblai/iblai-js/data-layer";
import { AuthProvider, TenantProvider } from "@iblai/iblai-js/web-utils";

import { iblaiStore } from "@/store/iblai-store";
import { LocalStorageService } from "@/lib/iblai/storage-service";
import config from "@/lib/iblai/config";
import { resolveAppTenant, checkTenantMismatch } from "@/lib/iblai/tenant";
import { redirectToAuthSpa } from "@/lib/iblai/auth-utils";

const storageService = LocalStorageService.getInstance();

/** Routes that do NOT require authentication. */
const PUBLIC_ROUTES = new Map<RegExp, () => Promise<boolean>>([
  [new RegExp("^/sso-login"), async () => false],
]);

export function IblaiProviders({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  // initializeDataLayer MUST be called synchronously before any children
  // render so that Config.lmsUrl / Config.dmUrl are set before RTK Query
  // hooks (e.g. inside the Profile component) fire their first queries.
  // useState initializer runs during the render cycle, not after it.
  const [isInitialized] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      // data-layer v1.2+ signature:
      // (dmUrl, lmsUrl, legacyLmsUrl, storageService, httpErrorHandler)
      initializeDataLayer(
        config.dmUrl(),
        config.lmsUrl(),
        // Dedicated edX host (learn.*) — NOT lmsUrl: on hosted defaults that
        // is the consolidated API path (api.iblai.app/lms), and the
        // legacy-LMS endpoints + edX iframes live on the real LMS host.
        config.legacyLmsUrl(),
        storageService,
        {
          401: () => redirectToAuthSpa(undefined, undefined, true),
        },
      );
    } catch (e) {
      console.error("[ibl.ai] initializeDataLayer failed:", e);
    }
    return true;
  });

  // `isInitialized` is false during SSR but true on the client's first render,
  // so gating the tree on it alone makes server and client markup disagree and
  // React throws a hydration mismatch on every route. Gate on a mount flag
  // instead: server and first client render both produce LOADING, and the tree
  // appears on the next commit. The data layer is still initialized
  // synchronously above, before any child can fire a query.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const username = useMemo(() => {
    if (typeof window === "undefined") return "";
    try {
      const raw = localStorage.getItem("userData");
      if (raw) return JSON.parse(raw).user_nicename ?? "";
    } catch { /* ignore */ }
    return "";
  }, [isInitialized]);

  // Tenant resolution: .env -> app_tenant -> localStorage tenant
  const tenantKey = useMemo(() => resolveAppTenant(), [isInitialized]);

  const isSsoRoute = pathname?.startsWith("/sso-login") ?? false;

  const LOADING = (
    <div className="flex min-h-screen items-center justify-center">
      <p className="text-sm text-gray-400">Loading...</p>
    </div>
  );

  if (!isInitialized || !mounted) return LOADING;

  return (
    <ReduxProvider store={iblaiStore}>
      <AuthProvider
        skip={isSsoRoute}
        redirectToAuthSpa={redirectToAuthSpa}
        username={username}
        pathname={pathname ?? "/"}
        storageService={storageService}
        middleware={PUBLIC_ROUTES}
        enableStorageSync
        fallback={LOADING}
      >
        <TenantProvider
          skip={isSsoRoute}
          currentTenant={tenantKey}
          requestedTenant={tenantKey}
          saveCurrentTenant={(t: any) => {
            const key = typeof t === "string" ? t : t?.key ?? String(t);
            localStorage.setItem("current_tenant", key);
            localStorage.setItem("tenant", key);

            // If the SDK resolved a different tenant than what the app
            // expects, redirect to re-login for the correct tenant.
            checkTenantMismatch();
          }}
          saveUserTenants={(t: unknown) =>
            localStorage.setItem("tenants", JSON.stringify(t))
          }
          // TenantProvider re-authenticates against the requested tenant and
          // hands back a fresh, tenant-scoped token pair. Without persisting it
          // the next membership check still runs on the pre-switch tokens, so
          // the provider loops on
          //   "User still does not belong to tenant after re-auth"
          // and the app never leaves its loading state. iblai/os wires these up
          // (providers/index.tsx -> saveUserTokens).
          saveUserTokens={(tokens: TokenResponse) => {
            if (tokens?.axd_token) {
              localStorage.setItem("axd_token", tokens.axd_token.token);
              localStorage.setItem("axd_token_expires", tokens.axd_token.expires);
            }
            if (tokens?.dm_token) {
              localStorage.setItem("dm_token", tokens.dm_token.token);
              localStorage.setItem("dm_token_expires", tokens.dm_token.expires);
            }
          }}
          saveTenant={(t: string) => localStorage.setItem("tenant", t)}
          onAuthFailure={(reason: string) =>
            console.error("[TenantProvider] Auth failure:", reason)
          }
          handleTenantSwitch={async () => {
            const tenant = resolveAppTenant();
            redirectToAuthSpa(undefined, tenant, false, true);
          }}
          redirectToAuthSpa={redirectToAuthSpa}
          username={username}
          fallback={LOADING}
        >
          {children}
        </TenantProvider>
      </AuthProvider>
    </ReduxProvider>
  );
}
