/**
 * Browser-side helper for the app's own /api/admin/* routes. The signed-in
 * user's session token (written to localStorage by the SDK at sign-in) is
 * forwarded as `Authorization: Token …`; the server verifies it against the
 * platform and decides whether the caller is an org admin. Never import a
 * server file from here.
 */
export type AgentSummary = { unique_id: string; name: string; description?: string };

export class AdminRequestError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "AdminRequestError";
  }
}

export const sessionToken = () =>
  typeof window === "undefined" ? "" : (localStorage.getItem("dm_token") ?? "");

export async function adminFetch<T = unknown>(
  path: string,
  init: Omit<RequestInit, "headers" | "body"> & { headers?: Record<string, string>; json?: unknown } = {},
): Promise<T> {
  const { json, headers, ...rest } = init;
  const token = sessionToken();
  const res = await fetch(path, {
    ...rest,
    headers: {
      ...(token && { Authorization: `Token ${token}` }),
      ...(json !== undefined && { "Content-Type": "application/json" }),
      ...headers,
    },
    ...(json !== undefined && { body: JSON.stringify(json) }),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok)
    throw new AdminRequestError(res.status, data?.error ?? data?.detail ?? `Request failed (${res.status})`);
  return data as T;
}
