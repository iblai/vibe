/**
 * The three first-run journeys of an ibl.ai official app
 * (/iblai-vibe-house-journeys): the pure rules behind the organization
 * preview, the trial-gated shell, the credit badge and the first-run gate.
 * Only `config` and localStorage, so the unit test runs in node.
 */
// Relative import (not @/): vitest resolves no alias for lib files.
import config from "./config";

/** One organization of the signed-in user, as the sign-in stores them (`tenants`). */
export type OrgEntry = {
  key: string;
  is_admin?: boolean;
  show_paywall?: boolean | null;
  org?: string;
  name?: string;
  platform_name?: string;
};

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

/** The organizations the sign-in handed the browser (`tenants`), or [] when signed out. */
export function readTenants(): OrgEntry[] {
  try {
    const parsed = JSON.parse(storage()?.getItem("tenants") ?? "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function readUserData(): Record<string, unknown> {
  try {
    const parsed = JSON.parse(storage()?.getItem("userData") ?? "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export const readUsername = (): string => String(readUserData().user_nicename ?? "");
export const readUserEmail = (): string => String(readUserData().user_email ?? "");

/** The community organization every account belongs to. */
export const mainOrg = (): string => config.mainTenantKey() || "main";

/**
 * The organization a signed-in user works in when the URL names none: the
 * stored one unless it is the community one, else the first other one they
 * belong to, else the community one itself — the OS's experience for a user
 * whose only organization is `main`.
 */
export function ownOrg(stored: string, tenants: ReadonlyArray<OrgEntry>, main = mainOrg()): string {
  if (stored && stored !== main && tenants.some((t) => t.key === stored)) return stored;
  return tenants.find((t) => t.key && t.key !== main)?.key ?? main;
}

export type Entry = {
  /** `enter` one of theirs, `main` the community one, `preview` one they do not belong to. */
  kind: "enter" | "main" | "preview";
  /** The organization the app runs on. */
  org: string;
  /** The organization previewed, when `kind` is `preview`. */
  preview?: string;
};

/**
 * Where a signed-in user works. A route organization they belong to is
 * entered; one they do not is previewed, with the app running on their own
 * organization underneath — so the SDK never attempts a join from a link.
 * With no organizations stored yet the route is trusted (the SDK decides).
 */
export function decideEntry({
  routeOrg,
  stored,
  tenants,
  main = mainOrg(),
}: {
  routeOrg: string;
  stored: string;
  tenants: ReadonlyArray<OrgEntry>;
  main?: string;
}): Entry {
  if (tenants.length === 0) {
    const org = routeOrg || stored || main;
    return { kind: org === main ? "main" : "enter", org };
  }
  const own = ownOrg(stored, tenants, main);
  if (routeOrg && !tenants.some((t) => t.key === routeOrg)) {
    return { kind: "preview", org: own, preview: routeOrg };
  }
  const org = routeOrg || own;
  return { kind: org === main ? "main" : "enter", org };
}

/** The OS's free-trial rule: on the community organization, not its admin, and in no other. */
export function isTrialUser(org: string, tenants: ReadonlyArray<OrgEntry>, main = mainOrg()): boolean {
  return org === main && tenants.length === 1 && tenants[0]?.key === main && !tenants[0]?.is_admin;
}

/** The login page with this app nested inside — where the platform returns a user after a checkout. */
export function loginReturnUrl(origin: string, app = "mentor"): string {
  return `${config.authUrl()}/login?app=${encodeURIComponent(app)}&redirect-to=${encodeURIComponent(origin)}`;
}

/**
 * ibl.ai's own $0 sign-up — the checkout `ibl.ai/join` resolves to — told to
 * come back here. The platform merges its return parameters into
 * `redirect_url` without disturbing the nested address, the login page signs
 * the new organization's admin in and hands back to the app; a cancelled
 * checkout returns the same way to where they were. The email prefills and
 * locks the checkout, so the new organization attaches to this account.
 */
export function createOrganizationUrl(origin: string, email = "", app = "mentor"): string {
  const back = loginReturnUrl(origin, app);
  const params = new URLSearchParams({ redirect_url: back, cancel_url: back });
  if (email) params.set("email", email);
  return `${config.dmUrl()}/api/service/stripe/checkout/redirect/credits-free-plan/?${params}`;
}

export type OnboardingFlow = "admin" | "user";

/**
 * Which flow /onboarding runs — the LMS's rule. Members get the member flow;
 * admins get it too by default (it is what their organization shows people)
 * and the setup flow when none is configured or `?flow=admin` says so. An
 * agent link is a member link.
 */
export function onboardingFlow({
  isAdmin,
  flowParam,
  agentId,
  formReady,
}: {
  isAdmin: boolean;
  flowParam?: string | null;
  agentId?: string | null;
  /** The organization's form is switched on and has a question or an agent. */
  formReady: boolean;
}): OnboardingFlow {
  if (!isAdmin) return "user";
  if (flowParam === "admin" || flowParam === "user") return flowParam;
  if (agentId) return "user";
  return formReady ? "user" : "admin";
}

/**
 * Who is sent to /onboarding on first run: an admin until the setup flow is
 * completed, a member while the organization's form waits for their answers.
 */
export function firstRunTarget({
  isAdmin,
  completed,
  formReady,
  submitted,
}: {
  isAdmin: boolean;
  /** `onboarding.completed` in the admin's own platform metadata for the organization. */
  completed: boolean;
  formReady: boolean;
  /** The member's answers are already in the organization's metadata. */
  submitted: boolean;
}): OnboardingFlow | null {
  if (isAdmin) return completed ? null : "admin";
  return formReady && !submitted ? "user" : null;
}
