"use client";

/**
 * Typed, namespaced access to the two "custom data" stores every ibl.ai app
 * has — no database and no localStorage of your own:
 *
 *  - USER settings: one JSON object per user × org
 *    (`…/dm/api/core/users/platform-metadata/`). Preferences, flags,
 *    onboarding progress, app state. The SDK hook PATCHes (merge), so
 *    unrelated keys survive.
 *  - ORG settings: the org's public metadata object
 *    (`…/dm/api/core/orgs/{org}/metadata/`). It holds the OS's OWN settings
 *    (default agent, help center, auth-page branding, toggles) and yours.
 *    **PUT replaces the whole object** — this helper always GETs, merges, PUTs.
 *    It is a public read: never store secrets in it.
 *
 * Both are namespaced under `apps.<APP_SLUG>` so several apps on one org
 * never collide (vibe-agent keeps its paywall choice the same way).
 *
 * Writing ANOTHER user's settings needs the org's authority — see
 * app/api/admin/user-metadata/route.ts (server, Api-Token), not this file.
 */
import { useCallback, useMemo } from "react";
import {
  useGetTenantMetadataQuery,
  useGetUserPlatformMetadataQuery,
  useUpdateTenantMetadataMutation,
  useUpdateUserPlatformMetadataMutation,
} from "@iblai/iblai-js/data-layer";
import { resolveAppTenant } from "./tenant";
import { mergeAppNamespace, readAppNamespace, type Metadata } from "./metadata-core";

export { APP_SLUG, mergeAppNamespace, readAppNamespace } from "./metadata-core";

// ---------- user settings ----------

/** Extend with your own fields; keep them flat and JSON-serializable. */
export type UserSettings = {
  theme?: "light" | "dark";
  onboardingStep?: number;
  onboardingDone?: boolean;
  [key: string]: unknown;
};

export const USER_SETTINGS_DEFAULTS: UserSettings = {
  theme: "light",
  onboardingStep: 0,
  onboardingDone: false,
};

/**
 * The signed-in user's settings for this app in this org.
 * `update` merges; `remove` deletes keys. Unknown/failed reads fall back to
 * the defaults so the UI never breaks on a missing record.
 */
export function useUserSettings<T extends UserSettings = UserSettings>(
  defaults: T = USER_SETTINGS_DEFAULTS as T,
) {
  const tenantKey = resolveAppTenant();
  const query = useGetUserPlatformMetadataQuery({ tenantKey }, { skip: !tenantKey });
  const [mutate, mutation] = useUpdateUserPlatformMetadataMutation();

  const settings = useMemo(
    () => ({ ...defaults, ...(readAppNamespace(query.data?.metadata) as Partial<T>) }) as T,
    [defaults, query.data],
  );

  const update = useCallback(
    async (patch: Partial<T>) => {
      // PATCH merges at the top level only; send the whole `apps` subtree.
      const metadata = mergeAppNamespace(query.data?.metadata, patch as Metadata);
      await mutate({ tenantKey, metadata: { apps: metadata.apps } }).unwrap();
    },
    [mutate, query.data, tenantKey],
  );

  const remove = useCallback(
    async (keys: (keyof T & string)[]) => {
      const metadata = mergeAppNamespace(query.data?.metadata, {}, keys);
      await mutate({ tenantKey, metadata: { apps: metadata.apps } }).unwrap();
    },
    [mutate, query.data, tenantKey],
  );

  return {
    settings,
    update,
    remove,
    isLoading: query.isLoading,
    isSaving: mutation.isLoading,
    error: query.error ?? mutation.error,
    refetch: query.refetch,
  };
}

// ---------- org settings ----------

/** Extend with your own fields. Public read — nothing secret goes here. */
export type OrgSettings = {
  /** The agent the home page chats with when NEXT_PUBLIC_DEFAULT_AGENT_ID is empty. */
  defaultAgentId?: string;
  /** What the app calls itself (browser tab, setup). */
  appName?: string;
  welcomeMessage?: string;
  supportUrl?: string;
  /** Set by /setup when an admin finished the first run. */
  setupCompletedAt?: string;
  [key: string]: unknown;
};

export const ORG_SETTINGS_DEFAULTS: OrgSettings = {
  defaultAgentId: "",
  appName: "",
  welcomeMessage: "",
  supportUrl: "",
};

type OrgMetadataResponse = { metadata?: Metadata; [k: string]: unknown };
type PlatformPublicMetadataBody = NonNullable<Parameters<ReturnType<typeof useUpdateTenantMetadataMutation>[0]>[0][0]["requestBody"]>;

/**
 * The org's settings for this app. Any member can read (public); writes need
 * an org admin — the platform answers 403 otherwise.
 *
 * `update` performs GET → merge → PUT, so the OS's own keys
 * (`overall_default_mentor`, `help_center_url`, `auth_web_*`, …) are preserved.
 */
export function useOrgSettings<T extends OrgSettings = OrgSettings>(
  defaults: T = ORG_SETTINGS_DEFAULTS as T,
) {
  const org = resolveAppTenant();
  // The `tenant` metadata slice takes its args as a one-element tuple.
  const query = useGetTenantMetadataQuery([{ org }], { skip: !org });
  const [mutate, mutation] = useUpdateTenantMetadataMutation();

  const current = query.data as OrgMetadataResponse | undefined;

  const settings = useMemo(
    () => ({ ...defaults, ...(readAppNamespace(current?.metadata) as Partial<T>) }) as T,
    [defaults, current],
  );

  const update = useCallback(
    async (patch: Partial<T>) => {
      // Re-read right before writing: PUT replaces the object, and another
      // admin (or the OS) may have changed it since this page loaded.
      const latest = (await query.refetch().unwrap()) as OrgMetadataResponse;
      const metadata = mergeAppNamespace(latest?.metadata, patch as Metadata);
      // The endpoint's body is `{ "metadata": {…whole object…} }`; the
      // generated type carries the read-only response fields, hence the cast.
      await mutate([
        { org, requestBody: { metadata } as unknown as PlatformPublicMetadataBody },
      ]).unwrap();
    },
    [mutate, org, query],
  );

  return {
    settings,
    update,
    isLoading: query.isLoading,
    isSaving: mutation.isLoading,
    error: query.error ?? mutation.error,
    refetch: query.refetch,
  };
}
