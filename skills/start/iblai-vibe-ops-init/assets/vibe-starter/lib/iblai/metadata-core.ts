/**
 * Pure helpers for the app's metadata namespace (`metadata.apps[APP_SLUG]`).
 * No React, no SDK — unit-tested in __tests__/metadata.test.ts and shared by
 * lib/iblai/metadata.ts (browser hooks) and the admin routes (server).
 */
import config from "./config";

/** Keys under which this app's data lives: `metadata.apps[APP_SLUG]`. */
export const APP_SLUG = slugify(config.appName() || "vibe-starter");

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "app";
}

export type Metadata = Record<string, unknown>;

export function readAppNamespace(metadata: unknown): Metadata {
  const apps = (metadata as { apps?: Record<string, unknown> } | null)?.apps;
  const mine = apps?.[APP_SLUG];
  return mine && typeof mine === "object" ? (mine as Metadata) : {};
}

/** Merge `patch` into `metadata.apps[APP_SLUG]`, dropping `remove` keys, without touching anything else. */
export function mergeAppNamespace(metadata: unknown, patch: Metadata, remove: string[] = []): Metadata {
  const root = metadata && typeof metadata === "object" ? { ...(metadata as Metadata) } : {};
  const apps = { ...(root.apps as Record<string, unknown> | undefined) };
  const mine: Metadata = { ...readAppNamespace(root), ...patch };
  for (const k of remove) delete mine[k];
  apps[APP_SLUG] = mine;
  root.apps = apps;
  return root;
}

