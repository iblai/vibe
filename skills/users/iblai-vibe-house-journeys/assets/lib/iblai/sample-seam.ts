/**
 * The community organization's sample (/iblai-vibe-house-journeys): a trial
 * user browses the app on sample data that never reaches the platform. The
 * seam sits in the app's RTK Query base query, so every page reads the sample
 * without knowing it.
 */
import type { BaseQueryFn, FetchArgs } from "@reduxjs/toolkit/query";
import { setOpenPricingModal } from "@iblai/iblai-js/web-utils";
// Relative import (not @/): vitest resolves no alias for lib files.
import { isTrialUser, mainOrg, readTenants } from "./house-journeys";

/** The app's own sample: a read's response body, or `undefined` for anything that is not one. */
export type SampleRespond = (method: string, url: string, body?: unknown) => unknown;

/** The organization this page runs on: the route's `/platform/<org>`, else the session's. */
export function currentOrg(): string {
  if (typeof window === "undefined") return "";
  const match = window.location.pathname.match(/^\/platform\/([^/]+)/);
  return match ? decodeURIComponent(match[1]) : (window.localStorage.getItem("tenant") ?? "");
}

/** Whether this page runs on the sample: the trial user on the community organization. */
export const onSample = (): boolean => isTrialUser(currentOrg(), readTenants(), mainOrg());

/**
 * Wraps a base query: on the sample a read answers from `respond`, and
 * anything else opens the upgrade dialog and fails with `status: "SAMPLE"`.
 */
export function withSample<E>(
  baseQuery: BaseQueryFn<string | FetchArgs, unknown, E>,
  respond: SampleRespond,
  isSample: () => boolean = onSample,
): BaseQueryFn<string | FetchArgs, unknown, E | { status: "SAMPLE" }> {
  return async (args, api, extra) => {
    if (!isSample()) return baseQuery(args, api, extra);
    const request = typeof args === "string" ? { url: args } : args;
    const data = respond(request.method ?? "GET", request.url, request.body);
    if (data !== undefined) return { data };
    api.dispatch(setOpenPricingModal(true));
    return { error: { status: "SAMPLE" } };
  };
}
